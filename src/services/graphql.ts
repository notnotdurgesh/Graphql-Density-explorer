import { GraphQLClient, gql, ClientError } from 'graphql-request';
import {
  GraphQLType,
  GraphQLField,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLInputType,
  GraphQLDirective,
  SchemaStats,
} from '../stores/useAppStore';

interface IntrospectionType {
  kind: string;
  name: string;
  description?: string;
  fields?: {
    name: string;
    description?: string;
    isDeprecated?: boolean;
    deprecationReason?: string;
    args?: {
      name: string;
      description?: string;
      defaultValue?: string;
      type: GraphQLTypeFragment;
    }[];
    type: GraphQLTypeFragment;
  }[];
  inputFields?: {
    name: string;
    description?: string;
    defaultValue?: string;
    type: GraphQLTypeFragment;
  }[];
  interfaces?: { name: string }[];
  enumValues?: {
    name: string;
    description?: string;
    isDeprecated?: boolean;
    deprecationReason?: string;
  }[];
  possibleTypes?: { name: string }[];
}

interface IntrospectionSchema {
  queryType: { name: string };
  mutationType?: { name: string } | null;
  subscriptionType?: { name: string } | null;
  types: IntrospectionType[];
  directives: {
    name: string;
    description?: string;
    locations: string[];
    args: {
      name: string;
      description?: string;
      defaultValue?: string;
      type: GraphQLTypeFragment;
    }[];
  }[];
}

// Fallback queries for endpoints with strict query depth limits
const INTROSPECTION_QUERIES = [
  // 1: Deep Introspection (Robust but deep)
  gql`
    query IntrospectionDeep {
      __schema {
        queryType {
          name
        }
        mutationType {
          name
        }
        subscriptionType {
          name
        }
        types {
          name
          description
          kind
          fields(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
            args {
              name
              description
              defaultValue
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
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
          inputFields {
            name
            description
            defaultValue
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
          interfaces {
            name
          }
          enumValues(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
          }
          possibleTypes {
            name
          }
        }
        directives {
          name
          description
          locations
          args {
            name
            description
            defaultValue
            type {
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
  `,
  // 2: Medium Introspection (Depth 6)
  gql`
    query IntrospectionMedium {
      __schema {
        queryType {
          name
        }
        mutationType {
          name
        }
        subscriptionType {
          name
        }
        types {
          name
          description
          kind
          fields(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
            args {
              name
              description
              type {
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
          inputFields {
            name
            description
            type {
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
          interfaces {
            name
          }
          enumValues(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
          }
          possibleTypes {
            name
          }
        }
      }
    }
  `,
  // 3: Shallow Introspection (Depth 5) - Stellate Default Limit
  gql`
    query IntrospectionShallow {
      __schema {
        queryType {
          name
        }
        mutationType {
          name
        }
        subscriptionType {
          name
        }
        types {
          name
          description
          kind
          fields {
            name
            description
            args {
              name
              type {
                kind
                name
              }
            }
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
          inputFields {
            name
            type {
              kind
              name
            }
          }
          interfaces {
            name
          }
          enumValues {
            name
            description
          }
          possibleTypes {
            name
          }
        }
      }
    }
  `,
  // 4: Minimal Introspection (Depth 4) - Extreme Fallback
  gql`
    query IntrospectionMinimal {
      __schema {
        queryType {
          name
        }
        mutationType {
          name
        }
        subscriptionType {
          name
        }
        types {
          name
          description
          kind
          fields {
            name
            description
            args {
              name
            }
            type {
              kind
              name
            }
          }
          inputFields {
            name
          }
          interfaces {
            name
          }
          enumValues {
            name
            description
          }
          possibleTypes {
            name
          }
        }
      }
    }
  `,
];

interface GraphQLTypeFragment {
  kind: string;
  name?: string;
  ofType?: GraphQLTypeFragment;
}

function unwrapType(type: GraphQLTypeFragment): {
  name: string;
  isList: boolean;
  isRequired: boolean;
  kind: string;
} {
  let isRequired = false;
  let isList = false;
  let currentType: GraphQLTypeFragment | undefined = type;

  // Track if the outermost wrapper is NON_NULL
  if (currentType?.kind === 'NON_NULL') {
    isRequired = true;
  }

  let depth = 0;
  while (
    currentType &&
    (currentType.kind === 'NON_NULL' || currentType.kind === 'LIST') &&
    depth < 10
  ) {
    if (currentType.kind === 'LIST') isList = true;
    if (currentType.ofType) {
      currentType = currentType.ofType;
    } else {
      break;
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

function unwrapTypeName(type: GraphQLTypeFragment | null | undefined): string {
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

export async function introspectFullSchema(
  endpoint: string,
  headers: Record<string, string>
): Promise<FullIntrospectionResult> {
  const client = new GraphQLClient(endpoint, { headers });
  let data: { __schema: IntrospectionSchema } | null = null;
  let lastError: Error | ClientError | null = null;

  for (let i = 0; i < INTROSPECTION_QUERIES.length; i++) {
    try {
      data = await client.request<{ __schema: IntrospectionSchema }>(INTROSPECTION_QUERIES[i]);
      break; // Success!
    } catch (err) {
      const error = err as Error;
      console.warn(`Introspection Level ${i + 1} failed:`, error.message);
      lastError = error;
    }
  }

  if (!data) {
    const errorMessage =
      lastError instanceof ClientError
        ? lastError.response?.errors?.[0]?.message
        : (lastError as Error)?.message;

    throw new Error(errorMessage || 'Failed to introspect schema (all fallbacks failed)');
  }

  const allTypes = (data.__schema.types as IntrospectionType[]).filter(
    (t: IntrospectionType) => !t.name.startsWith('__')
  );
  const queryTypeName = data.__schema.queryType?.name || 'Query';
  const mutationTypeName = data.__schema.mutationType?.name || null;
  const subscriptionTypeName = data.__schema.subscriptionType?.name || null;

  const rootTypeNames = new Set(
    [queryTypeName, mutationTypeName, subscriptionTypeName].filter(Boolean)
  );

  const objectTypes: GraphQLType[] = allTypes
    .filter((t: IntrospectionType) => t.kind === 'OBJECT' && !rootTypeNames.has(t.name))
    .map((t: IntrospectionType) => {
      const fields: GraphQLField[] = (t.fields || [])
        .filter((f) => {
          // Skip fields that require non-nullable arguments without default values (hard to guess)
          const hasRequiredArgs = f.args?.some((arg) => {
            const unwrappedArg = unwrapType(arg.type);
            return unwrappedArg.isRequired && !arg.defaultValue;
          });
          return !hasRequiredArgs;
        })
        .map((f) => {
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
    .filter((t: IntrospectionType) => t.kind === 'ENUM')
    .map((t: IntrospectionType) => ({
      name: t.name,
      description: t.description,
      values: (t.enumValues || []).map((v) => ({
        name: v.name,
        description: v.description,
        isDeprecated: v.isDeprecated,
        deprecationReason: v.deprecationReason,
      })),
    }));

  // Interface types
  const interfaces: GraphQLInterfaceType[] = allTypes
    .filter((t: IntrospectionType) => t.kind === 'INTERFACE')
    .map((t: IntrospectionType) => ({
      name: t.name,
      description: t.description,
      fields: (t.fields || []).map((f) => {
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
      possibleTypes: (t.possibleTypes || []).map((p) => p.name),
    }));

  // Union types
  const unions: GraphQLUnionType[] = allTypes
    .filter((t: IntrospectionType) => t.kind === 'UNION')
    .map((t: IntrospectionType) => ({
      name: t.name,
      description: t.description,
      possibleTypes: (t.possibleTypes || []).map((p) => p.name),
    }));

  // Input types
  const inputTypes: GraphQLInputType[] = allTypes
    .filter((t: IntrospectionType) => t.kind === 'INPUT_OBJECT')
    .map((t: IntrospectionType) => ({
      name: t.name,
      description: t.description,
      fields: (t.inputFields || []).map((f) => {
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
  const directives: GraphQLDirective[] = (data.__schema.directives || []).map((d) => ({
    name: d.name,
    description: d.description,
    locations: d.locations,
    args: (d.args || []).map((a) => ({
      name: a.name,
      type: unwrapTypeName(a.type),
      description: a.description,
      defaultValue: a.defaultValue,
    })),
  }));

  // Query/Mutation root fields
  const queryRoot = allTypes.find((t: IntrospectionType) => t.name === queryTypeName);
  const mutationRoot = mutationTypeName
    ? allTypes.find((t: IntrospectionType) => t.name === mutationTypeName)
    : null;

  let totalFields = 0;
  objectTypes.forEach((t) => (totalFields += t.fields.length));

  const stats: SchemaStats = {
    objectTypeCount: objectTypes.length,
    enumTypeCount: enums.length,
    interfaceTypeCount: interfaces.length,
    unionTypeCount: unions.length,
    inputTypeCount: inputTypes.length,
    directiveCount: directives.length,
    totalFields,
    queryFields: (queryRoot?.fields || []).map((f) => f.name),
    mutationFields: (mutationRoot?.fields || []).map((f) => f.name),
  };

  return { objectTypes, enums, interfaces, unions, inputTypes, directives, stats };
}

// Keep for backward compat
export async function introspectSchema(
  endpoint: string,
  headers: Record<string, string>
): Promise<GraphQLType[]> {
  const result = await introspectFullSchema(endpoint, headers);
  return result.objectTypes;
}

export async function fetchSampleData(
  endpoint: string,
  headers: Record<string, string>,
  type: GraphQLType,
  limit: number = 200,
  onProgress?: (message: string) => void
): Promise<Record<string, unknown>[]> {
  const client = new GraphQLClient(endpoint, { headers });

  // 1. Get root query type name dynamically
  onProgress?.('Initializing discovery mechanism...');
  const introspectionData = await client.request<{ __schema: { queryType: { name: string } } }>(gql`
    query GetRootQueryName {
      __schema {
        queryType {
          name
        }
      }
    }
  `);

  const queryTypeName = introspectionData?.__schema?.queryType?.name || 'Query';

  // 2. Get fields of the root query type
  onProgress?.(`Probing Query root: ${queryTypeName}`);
  const queryRootData = await client.request<{ __type: { fields: any[] } }>(
    gql`
      query GetQueryFields($name: String!) {
        __type(name: $name) {
          fields {
            name
            args {
              name
            }
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
      }
    `,
    { name: queryTypeName }
  );

  const queryFields = queryRootData?.__type?.fields || [];

  // 3. Find a field returning list of this type, or connection
  // Rank potential fields based on name similarity and return type
  // 3. Find the best path to this type using BFS from the root Query
  const typePaths: {
    field: any;
    path: string[];
    score: number;
    isConnection: boolean;
  }[] = [];

  // Simple BFS to find paths from root Query fields to the target type
  // We limit depth to 2 to keep queries reasonable (Root -> Type or Root -> Connection -> Type)
  for (const f of queryFields) {
    const unwrapped = unwrapType(f.type);

    // Direct match (List or Single)
    if (unwrapped.name === type.name) {
      typePaths.push({
        field: f,
        path: [f.name],
        score: unwrapped.isList ? 100 : 80,
        isConnection: false,
      });
      continue;
    }

    // Check if it's a Connection
    if (
      unwrapped.name.endsWith('Connection') ||
      unwrapped.name.endsWith('Response') ||
      unwrapped.name.endsWith('Result')
    ) {
      // Introspect this wrapper type to see if it has 'nodes', 'edges', or 'items' of the target type
      try {
        const wrapperTypeData: any = await client.request(
          gql`
            query GetWrapperFields($name: String!) {
              __type(name: $name) {
                fields {
                  name
                  type {
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
          `,
          { name: unwrapped.name }
        );

        const wrapperFields = wrapperTypeData?.__type?.fields || [];
        for (const wf of wrapperFields) {
          const wUnwrapped = unwrapType(wf.type);
          if (wUnwrapped.name === type.name) {
            typePaths.push({
              field: f,
              path: [f.name, wf.name],
              score: 95,
              isConnection: ['edges', 'nodes', 'items'].includes(wf.name),
            });
          }
        }
      } catch {
        // Skip wrapper if introspection fails
      }
    }

    // Name-based fuzzy match as fallback
    if (f.name.toLowerCase().includes(type.name.toLowerCase())) {
      typePaths.push({
        field: f,
        path: [f.name],
        score: 40,
        isConnection: false,
      });
    }
  }

  const bestPaths = typePaths.sort((a, b) => b.score - a.score);

  if (bestPaths.length === 0) {
    throw new Error(
      `Industry-level discovery failed: No path found from Query root to ${type.name}.`
    );
  }

  // 4. Try the best potential paths
  for (const match of bestPaths) {
    const targetField = match.field;
    const isConnection = match.isConnection;
    const path = match.path;

    // Choose the best argument name for limit
    const args = targetField.args || [];
    const limitArg =
      args.find((a: any) => ['first', 'limit', 'size', 'count'].includes(a.name.toLowerCase()))
        ?.name || 'first';

    const fieldSelections = type.fields
      .map((f) => {
        // Don't nest too deep to avoid depth limits, but get basic info
        if (f.kind === 'OBJECT' || f.kind === 'INTERFACE' || f.kind === 'UNION') {
          return `${f.name} { __typename }`;
        }
        return f.name;
      })
      .join('\n');

    let queryStr = '';
    if (path.length === 2) {
      // Nested path (e.g., characters -> results -> fields)
      queryStr = `
            query Get${type.name}Sample {
                ${path[0]}(${limitArg}: ${limit}) {
                    ${path[1]} {
                        ${fieldSelections}
                    }
                }
            }
        `;
    } else if (isConnection) {
      queryStr = `
        query Get${type.name}Sample {
          ${targetField.name}(${limitArg}: ${limit}) {
            edges { node { ${fieldSelections} } }
            nodes { ${fieldSelections} }
            items { ${fieldSelections} }
          }
        }
      `;
    } else {
      queryStr = `
        query Get${type.name}Sample {
          ${targetField.name}(${limitArg}: ${limit}) {
            ${fieldSelections}
          }
        }
      `;
    }

    try {
      onProgress?.(`Executing discovery query via: ${path.join(' -> ')}`);
      const data = await client.request<Record<string, any>>(queryStr);
      const result = data[targetField.name];

      if (!result) continue;

      // Unpack based on path
      let items = result;
      if (path.length === 2) {
        items = result[path[1]];
      }

      const count = Array.isArray(items)
        ? items.length
        : items?.nodes?.length || items?.edges?.length || 0;
      onProgress?.(`Successfully fetched ${count} samples for ${type.name}`);

      if (Array.isArray(items)) return items;
      if (items?.edges)
        return items.edges.map((e: { node: Record<string, unknown> }) => e?.node).filter(Boolean);
      if (items?.nodes) return items.nodes.filter(Boolean);
      if (items?.items) return items.items.filter(Boolean);

      // If we got something but it's not a list, it might be a singleton or weird wrapper
      if (typeof result === 'object' && result !== null) {
        // Look for any array property
        const arrays = Object.values(result).filter((v) => Array.isArray(v));
        if (arrays.length > 0) return (arrays[0] as Record<string, unknown>[]).slice(0, limit);
      }
    } catch (err) {
      console.warn(`Attempt with field ${targetField.name} failed:`, err);
      // Try fallback without arguments
      try {
        const fallbackQuery = `query { ${targetField.name} { ${isConnection ? 'nodes { ' + fieldSelections + ' } edges { node { ' + fieldSelections + ' } }' : fieldSelections} } }`;
        const fallbackData = await client.request<Record<string, any>>(fallbackQuery);
        const fbResult = fallbackData[targetField.name];
        if (Array.isArray(fbResult)) return fbResult.slice(0, limit);
        if (fbResult?.nodes) return fbResult.nodes.slice(0, limit);
        if (fbResult?.edges)
          return fbResult.edges
            .map((e: { node: Record<string, unknown> }) => e.node)
            .slice(0, limit);
      } catch {
        continue; // Try next field
      }
    }
  }

  throw new Error(
    `Failed to fetch sample data for ${type.name} after trying all potential fields.`
  );
}

export async function executeQuery(
  endpoint: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; errors?: Record<string, unknown>[] }> {
  const client = new GraphQLClient(endpoint, { headers });
  try {
    const data = await client.request<Record<string, unknown>>(query, variables || {});
    return { data };
  } catch (err) {
    if (err instanceof ClientError) {
      return {
        data: (err.response?.data as Record<string, unknown>) || null,
        errors: (err.response?.errors as unknown as Record<string, unknown>[] | undefined) || [
          { message: err.message },
        ],
      };
    }
    return { data: null, errors: [{ message: (err as Error).message }] };
  }
}

export function generateQueryForType(type: GraphQLType, limit: number = 10): string {
  const fieldSelections = type.fields
    .map((f) => {
      if (f.kind === 'OBJECT' || f.kind === 'INTERFACE' || f.kind === 'UNION') {
        return `  ${f.name} {\n    __typename\n  }`;
      }
      return `  ${f.name}`;
    })
    .join('\n');

  // Convert type name to camelCase for query field guess
  const queryFieldName = type.name.charAt(0).toLowerCase() + type.name.slice(1) + 's';

  return `query Get${type.name}s {
  ${queryFieldName}(first: ${limit}) {
${fieldSelections}
  }
}`;
}

export function calculateDensity(
  data: Record<string, unknown>[],
  fields: GraphQLField[]
): Record<string, number> {
  const density: Record<string, number> = {};
  const total = data.length;

  if (total === 0) {
    fields.forEach((f) => (density[f.name] = 0));
    return density;
  }

  fields.forEach((f) => {
    let validCount = 0;
    data.forEach((item) => {
      const val = item[f.name];
      let isValid = false;

      // Rule: null and undefined are never valid
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          // Rule: empty arrays are treated as missing data (density lowering)
          // UNLESS the field is an object type where we just checked __typename
          isValid = val.length > 0 && val.some((v) => v !== null && v !== undefined && v !== '');
        } else if (typeof val === 'object' && !(val instanceof Date)) {
          // Rule: For objects, if we only requested __typename, check if it's there
          // Otherwise check if it has any keys
          isValid = Object.keys(val).length > 0;
        } else if (typeof val === 'string') {
          // Rule: Empty strings are invalid/missing
          isValid = val.trim().length > 0;
        } else if (typeof val === 'number') {
          // Rule: 0 is valid, but NaN and Infinity might be results of errors
          isValid = !isNaN(val) && isFinite(val);
        } else if (typeof val === 'boolean') {
          // Rule: false is a valid boolean value
          isValid = true;
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

export function analyzeNullPatterns(
  data: Record<string, unknown>[],
  fieldName: string
): {
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
    const isNull =
      val === null ||
      val === undefined ||
      val === '' ||
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

  let pattern: 'random' | 'clustered' | 'trailing' | 'leading' | 'all_null' | 'all_filled' =
    'random';
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
