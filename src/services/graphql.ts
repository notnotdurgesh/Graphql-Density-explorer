import { GraphQLClient, gql, ClientError } from 'graphql-request';
import { 
  GraphQLType, GraphQLField, GraphQLEnumType, GraphQLInterfaceType, 
  GraphQLUnionType, GraphQLInputType, GraphQLDirective, SchemaStats 
} from '../stores/useAppStore';

// Fallback queries for endpoints with strict query depth limits
const INTROSPECTION_QUERIES = [
  // 1: Deep Introspection (Robust but deep)
  gql`
    query IntrospectionDeep {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          name description kind
          fields(includeDeprecated: true) {
            name description isDeprecated deprecationReason
            args {
              name description defaultValue
              type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
            }
            type { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } }
          }
          inputFields {
            name description defaultValue
            type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
          }
          interfaces { name }
          enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
          possibleTypes { name }
        }
        directives {
          name description locations
          args {
            name description defaultValue
            type { kind name ofType { kind name ofType { kind name } } }
          }
        }
      }
    }
  `,
  // 2: Medium Introspection (Depth 6)
  gql`
    query IntrospectionMedium {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          name description kind
          fields(includeDeprecated: true) {
            name description isDeprecated deprecationReason
            args { name description type { kind name ofType { kind name ofType { kind name } } } }
            type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
          }
          inputFields { name description type { kind name ofType { kind name ofType { kind name } } } }
          interfaces { name }
          enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
          possibleTypes { name }
        }
      }
    }
  `,
  // 3: Shallow Introspection (Depth 5) - Stellate Default Limit
  gql`
    query IntrospectionShallow {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          name description kind
          fields {
            name description
            args { name type { kind name } }
            type { kind name ofType { kind name } }
          }
          inputFields { name type { kind name } }
          interfaces { name }
          enumValues { name description }
          possibleTypes { name }
        }
      }
    }
  `,
  // 4: Minimal Introspection (Depth 4) - Extreme Fallback
  gql`
    query IntrospectionMinimal {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          name description kind
          fields {
            name description
            args { name }
            type { kind name }
          }
          inputFields { name }
          interfaces { name }
          enumValues { name description }
          possibleTypes { name }
        }
      }
    }
  `
];

function unwrapType(type: any): { name: string; isList: boolean; isRequired: boolean; kind: string } {
  let isRequired = type?.kind === 'NON_NULL';
  let isList = false;
  let currentType = type;

  let depth = 0;
  while (currentType && (currentType.kind === 'NON_NULL' || currentType.kind === 'LIST') && depth < 10) {
    if (currentType.kind === 'LIST') isList = true;
    if (currentType.ofType) {
      currentType = currentType.ofType;
    } else {
      break; // Run out of depth in shallow query
    }
    depth++;
  }

  return {
    name: currentType?.name || 'Unknown',
    kind: currentType?.kind || 'Unknown',
    isList,
    isRequired,
  };
}

function unwrapTypeName(type: any): string {
  if (!type) return 'Unknown';
  if (type.kind === 'NON_NULL') return `${unwrapTypeName(type.ofType)}!`;
  if (type.kind === 'LIST') return `[${unwrapTypeName(type.ofType)}]`;
  return type.name || 'Unknown';
}

export interface FullIntrospectionResult {
  objectTypes: GraphQLType[];
  enums: GraphQLEnumType[];
  interfaces: GraphQLInterfaceType[];
  unions: GraphQLUnionType[];
  inputTypes: GraphQLInputType[];
  directives: GraphQLDirective[];
  stats: SchemaStats;
}

export async function introspectFullSchema(endpoint: string, headers: Record<string, string>): Promise<FullIntrospectionResult> {
  const client = new GraphQLClient(endpoint, { headers });
  let data: any = null;
  let lastError: any = null;

  for (let i = 0; i < INTROSPECTION_QUERIES.length; i++) {
    try {
      data = await client.request(INTROSPECTION_QUERIES[i]);
      break; // Success!
    } catch (err: any) {
      console.warn(`Introspection Level ${i + 1} failed:`, err.message);
      lastError = err;
      // Continue to try the shallower query
    }
  }

  if (!data) {
    throw new Error(lastError?.response?.errors?.[0]?.message || lastError?.message || 'Failed to introspect schema (all fallbacks failed)');
  }

  const allTypes = data.__schema.types.filter((t: any) => !t.name.startsWith('__'));
  const queryTypeName = data.__schema.queryType?.name || 'Query';
  const mutationTypeName = data.__schema.mutationType?.name || null;

  // Object types (excluding root Query, Mutation, Subscription)
  const rootTypeNames = new Set([queryTypeName, mutationTypeName, data.__schema.subscriptionType?.name].filter(Boolean));
  
  const objectTypes: GraphQLType[] = allTypes
    .filter((t: any) => t.kind === 'OBJECT' && !rootTypeNames.has(t.name))
    .map((t: any) => {
      const fields: GraphQLField[] = (t.fields || [])
        .filter((f: any) => {
          const hasRequiredArgs = f.args?.some((arg: any) => arg.type?.kind === 'NON_NULL' && !arg.defaultValue);
          return !hasRequiredArgs;
        })
        .map((f: any) => {
          const unwrapped = unwrapType(f.type);
          return {
            name: f.name,
            type: unwrapped.name,
            isRequired: unwrapped.isRequired,
            isList: unwrapped.isList,
            description: f.description,
            kind: unwrapped.kind,
          };
        });
      return { name: t.name, description: t.description, fields };
    })
    .filter((t: any) => t.fields.length > 0);

  // Enum types
  const enums: GraphQLEnumType[] = allTypes
    .filter((t: any) => t.kind === 'ENUM')
    .map((t: any) => ({
      name: t.name,
      description: t.description,
      values: (t.enumValues || []).map((v: any) => ({
        name: v.name,
        description: v.description,
        isDeprecated: v.isDeprecated,
        deprecationReason: v.deprecationReason,
      })),
    }));

  // Interface types
  const interfaces: GraphQLInterfaceType[] = allTypes
    .filter((t: any) => t.kind === 'INTERFACE')
    .map((t: any) => ({
      name: t.name,
      description: t.description,
      fields: (t.fields || []).map((f: any) => {
        const unwrapped = unwrapType(f.type);
        return {
          name: f.name,
          type: unwrapped.name,
          isRequired: unwrapped.isRequired,
          isList: unwrapped.isList,
          description: f.description,
          kind: unwrapped.kind,
        };
      }),
      possibleTypes: (t.possibleTypes || []).map((p: any) => p.name),
    }));

  // Union types
  const unions: GraphQLUnionType[] = allTypes
    .filter((t: any) => t.kind === 'UNION')
    .map((t: any) => ({
      name: t.name,
      description: t.description,
      possibleTypes: (t.possibleTypes || []).map((p: any) => p.name),
    }));

  // Input types
  const inputTypes: GraphQLInputType[] = allTypes
    .filter((t: any) => t.kind === 'INPUT_OBJECT')
    .map((t: any) => ({
      name: t.name,
      description: t.description,
      fields: (t.inputFields || []).map((f: any) => {
        const unwrapped = unwrapType(f.type);
        return {
          name: f.name,
          type: unwrapped.name,
          isRequired: unwrapped.isRequired,
          isList: unwrapped.isList,
          description: f.description,
          defaultValue: f.defaultValue,
        };
      }),
    }));

  // Directives
  const directives: GraphQLDirective[] = (data.__schema.directives || []).map((d: any) => ({
    name: d.name,
    description: d.description,
    locations: d.locations,
    args: (d.args || []).map((a: any) => ({
      name: a.name,
      type: unwrapTypeName(a.type),
      description: a.description,
      defaultValue: a.defaultValue,
    })),
  }));

  // Query/Mutation root fields
  const queryRoot = allTypes.find((t: any) => t.name === queryTypeName);
  const mutationRoot = mutationTypeName ? allTypes.find((t: any) => t.name === mutationTypeName) : null;

  let totalFields = 0;
  objectTypes.forEach(t => totalFields += t.fields.length);

  const stats: SchemaStats = {
    objectTypeCount: objectTypes.length,
    enumTypeCount: enums.length,
    interfaceTypeCount: interfaces.length,
    unionTypeCount: unions.length,
    inputTypeCount: inputTypes.length,
    directiveCount: directives.length,
    totalFields,
    queryFields: (queryRoot?.fields || []).map((f: any) => f.name),
    mutationFields: (mutationRoot?.fields || []).map((f: any) => f.name),
  };

  return { objectTypes, enums, interfaces, unions, inputTypes, directives, stats };
}

// Keep for backward compat
export async function introspectSchema(endpoint: string, headers: Record<string, string>): Promise<GraphQLType[]> {
  const result = await introspectFullSchema(endpoint, headers);
  return result.objectTypes;
}

export async function fetchSampleData(
  endpoint: string,
  headers: Record<string, string>,
  type: GraphQLType,
  limit: number = 200
): Promise<any[]> {
  const client = new GraphQLClient(endpoint, { headers });
  
  const queryRootData: any = await client.request(gql`
    query {
      __type(name: "Query") {
        fields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  `);

  const queryFields = queryRootData.__type.fields;
  
  // Find a field returning list of this type, or connection
  const targetField = queryFields.find((f: any) => {
    const unwrapped = unwrapType(f.type);
    if (unwrapped.name === type.name && unwrapped.isList) return true;
    if (unwrapped.name === `${type.name}Connection`) return true;
    return false;
  });

  if (!targetField) {
    throw new Error(`Could not find a query field returning a list of ${type.name}`);
  }

  let fieldSelections = type.fields.map(f => {
    if (f.kind === 'OBJECT' || f.kind === 'INTERFACE' || f.kind === 'UNION') {
      return `${f.name} { __typename }`;
    }
    return f.name;
  }).join('\n');

  if (!fieldSelections.trim()) {
    fieldSelections = '__typename';
  }

  const unwrappedTarget = unwrapType(targetField.type);
  
  let queryStr = '';
  if (unwrappedTarget.name === `${type.name}Connection`) {
    queryStr = `
      query Get${type.name}Sample {
        ${targetField.name}(first: ${limit}) {
          edges {
            node {
              ${fieldSelections}
            }
          }
        }
      }
    `;
  } else {
    queryStr = `
      query Get${type.name}Sample {
        ${targetField.name}(first: ${limit}) {
          ${fieldSelections}
        }
      }
    `;
  }

  try {
    const data: any = await client.request(queryStr);
    let result = data[targetField.name];
    
    if (result && result.edges) {
      result = result.edges.map((e: any) => e.node);
    } else if (result && result.nodes) {
      result = result.nodes;
    } else if (result && result.items) {
      result = result.items;
    }
    
    return Array.isArray(result) ? result : [];
  } catch (err: any) {
    if (err instanceof ClientError && err.response?.data && err.response.data[targetField.name]) {
      let result = err.response.data[targetField.name];
      if (result && result.edges) result = result.edges.map((e: any) => e?.node).filter(Boolean);
      else if (result && result.nodes) result = result.nodes.filter(Boolean);
      else if (result && result.items) result = result.items.filter(Boolean);
      
      if (Array.isArray(result) && result.length > 0) {
        return result;
      }
    }

    // Fallback without arguments
    let fallbackQueryStr = '';
    if (unwrappedTarget.name === `${type.name}Connection`) {
      fallbackQueryStr = `
        query Get${type.name}SampleFallback {
          ${targetField.name} {
            edges {
              node {
                ${fieldSelections}
              }
            }
          }
        }
      `;
    } else {
      fallbackQueryStr = `
        query Get${type.name}SampleFallback {
          ${targetField.name} {
            ${fieldSelections}
          }
        }
      `;
    }

    try {
      const fallbackData: any = await client.request(fallbackQueryStr);
      let result = fallbackData[targetField.name];
      if (result && result.edges) result = result.edges.map((e: any) => e.node);
      else if (result && result.nodes) result = result.nodes;
      else if (result && result.items) result = result.items;
      
      return Array.isArray(result) ? result.slice(0, limit) : [];
    } catch (fallbackErr: any) {
      if (fallbackErr instanceof ClientError && fallbackErr.response?.data && fallbackErr.response.data[targetField.name]) {
        let result = fallbackErr.response.data[targetField.name];
        if (result && result.edges) result = result.edges.map((e: any) => e?.node).filter(Boolean);
        else if (result && result.nodes) result = result.nodes.filter(Boolean);
        else if (result && result.items) result = result.items.filter(Boolean);
        
        if (Array.isArray(result) && result.length > 0) {
          return result.slice(0, limit);
        }
      }

      console.error(`Failed to fetch sample data for ${type.name}:`, fallbackErr);
      return [];
    }
  }
}

export async function executeQuery(
  endpoint: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, any>
): Promise<{ data: any; errors?: any[] }> {
  const client = new GraphQLClient(endpoint, { headers });
  try {
    const data = await client.request(query, variables || {});
    return { data };
  } catch (err: any) {
    if (err instanceof ClientError) {
      return { 
        data: err.response?.data || null, 
        errors: err.response?.errors || [{ message: err.message }] 
      };
    }
    return { data: null, errors: [{ message: err.message }] };
  }
}

export function generateQueryForType(type: GraphQLType, limit: number = 10): string {
  const fieldSelections = type.fields.map(f => {
    if (f.kind === 'OBJECT' || f.kind === 'INTERFACE' || f.kind === 'UNION') {
      return `  ${f.name} {\n    __typename\n  }`;
    }
    return `  ${f.name}`;
  }).join('\n');

  // Convert type name to camelCase for query field guess
  const queryFieldName = type.name.charAt(0).toLowerCase() + type.name.slice(1) + 's';
  
  return `query Get${type.name}s {
  ${queryFieldName}(first: ${limit}) {
${fieldSelections}
  }
}`;
}

export function calculateDensity(data: any[], fields: GraphQLField[]): Record<string, number> {
  const density: Record<string, number> = {};
  const total = data.length;

  if (total === 0) {
    fields.forEach(f => density[f.name] = 0);
    return density;
  }

  fields.forEach(f => {
    let validCount = 0;
    data.forEach(item => {
      const val = item[f.name];
      let isValid = false;

      if (val !== null && val !== undefined && val !== '') {
        if (Array.isArray(val)) {
          isValid = val.length > 0 && val.some(v => v !== null && v !== undefined && v !== '');
        } else if (typeof val === 'object') {
          if (Object.keys(val).length > 0 || val instanceof Date) {
            isValid = true;
          }
        } else {
          isValid = true;
        }
      }

      if (isValid) {
        validCount++;
      }
    });
    density[f.name] = (validCount / total) * 100;
  });

  return density;
}

export function analyzeNullPatterns(data: any[], fieldName: string): {
  totalRecords: number;
  nullCount: number;
  nonNullCount: number;
  nullPercentage: number;
  longestNullStreak: number;
  longestNonNullStreak: number;
  pattern: 'random' | 'clustered' | 'trailing' | 'leading' | 'all_null' | 'all_filled';
} {
  const total = data.length;
  let nullCount = 0;
  let maxNullStreak = 0;
  let maxNonNullStreak = 0;
  let currentNullStreak = 0;
  let currentNonNullStreak = 0;
  let firstNullIdx = -1;
  let lastNullIdx = -1;

  data.forEach((item, idx) => {
    const val = item[fieldName];
    const isNull = val === null || val === undefined || val === '' || 
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === 'object' && val !== null && Object.keys(val).length === 0);

    if (isNull) {
      nullCount++;
      currentNullStreak++;
      currentNonNullStreak = 0;
      if (firstNullIdx === -1) firstNullIdx = idx;
      lastNullIdx = idx;
      maxNullStreak = Math.max(maxNullStreak, currentNullStreak);
    } else {
      currentNonNullStreak++;
      currentNullStreak = 0;
      maxNonNullStreak = Math.max(maxNonNullStreak, currentNonNullStreak);
    }
  });

  const nonNullCount = total - nullCount;

  let pattern: 'random' | 'clustered' | 'trailing' | 'leading' | 'all_null' | 'all_filled' = 'random';
  if (nullCount === 0) pattern = 'all_filled';
  else if (nullCount === total) pattern = 'all_null';
  else if (firstNullIdx === 0 && maxNullStreak === nullCount) pattern = 'leading';
  else if (lastNullIdx === total - 1 && maxNullStreak === nullCount) pattern = 'trailing';
  else if (maxNullStreak > total * 0.3) pattern = 'clustered';
  else pattern = 'random';

  return {
    totalRecords: total,
    nullCount,
    nonNullCount,
    nullPercentage: total > 0 ? (nullCount / total) * 100 : 0,
    longestNullStreak: maxNullStreak,
    longestNonNullStreak: maxNonNullStreak,
    pattern,
  };
}


