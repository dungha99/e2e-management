"use client"

/**
 * Shared connector form utilities used by both ExecuteConnectorDialog and UseFlowWizardDialog.
 * Handles schema parsing, dict_variables enrichment, field value management, and field rendering.
 */

export interface SchemaProperty {
  type?: string
  default?: any
  description?: string
  enum?: string[]
  hidden?: boolean
  "read-only"?: boolean
  required?: boolean
  properties?: Record<string, SchemaProperty>
}

export interface ParsedField {
  name: string
  label: string
  type: string
  required: boolean
  default?: any
  description?: string
  enumValues?: string[]
  hidden?: boolean
  readOnly?: boolean
  subFields?: ParsedField[]
}

/**
 * Parse a connector's input_schema into an array of ParsedField objects.
 * Handles multiple schema structures: top-level properties, body.properties, and direct body fields.
 */
export function parseInputSchema(inputSchema: any): ParsedField[] | null {
  if (!inputSchema || typeof inputSchema !== "object") return null

  let properties = inputSchema.properties
  if (!properties && inputSchema.body) {
    if (inputSchema.body.properties) {
      properties = inputSchema.body.properties
    } else {
      properties = inputSchema.body
    }
  }

  if (!properties || typeof properties !== "object") return null

  const requiredFields: string[] = Array.isArray(inputSchema.required) ? inputSchema.required : []

  return Object.entries(properties).map(([name, prop]) => {
    const schemaProp = prop as SchemaProperty
    const field: ParsedField = {
      name,
      label: schemaProp.description || name,
      type: schemaProp.type || "string",
      required: schemaProp.required || requiredFields.includes(name),
      default: schemaProp.default,
      description: schemaProp.description,
      enumValues: schemaProp.enum,
      hidden: schemaProp.hidden === true,
      readOnly: schemaProp["read-only"] === true,
    }

    if ((schemaProp.type === 'dict' || schemaProp.type === 'object') && schemaProp.properties) {
      field.subFields = Object.entries(schemaProp.properties).map(([subName, subProp]) => {
        const subSchemaProp = subProp as SchemaProperty
        return {
          name: `${name}.${subName}`,
          label: subSchemaProp.description || subName,
          type: subSchemaProp.type || "string",
          required: subSchemaProp.required || false,
          default: subSchemaProp.default,
          description: subSchemaProp.description,
          enumValues: subSchemaProp.enum,
          hidden: subSchemaProp.hidden === true,
          readOnly: subSchemaProp["read-only"] === true,
        }
      })
    }

    return field
  })
}

/**
 * Fetch dict_variables and enrich dict/object fields with their sub-fields.
 */
export async function enrichDictFields(fields: ParsedField[]): Promise<ParsedField[]> {
  const dictFields = fields.filter(f => f.type === 'dict' || f.type === 'object')
  if (dictFields.length === 0) return fields

  try {
    const res = await fetch('/api/e2e/tables/dict_variables?limit=100')
    if (!res.ok) return fields

    const data = await res.json()

    return fields.map(field => {
      if (field.type !== 'dict' && field.type !== 'object') return field

      const dictVar = data.data?.find((d: any) => d.name === field.name)
      if (!dictVar || !dictVar.variables) return field

      let variables = dictVar.variables
      if (typeof variables === 'string') {
        try { variables = JSON.parse(variables) } catch { return field }
      }

      const subFields: ParsedField[] = Object.entries(variables).map(([subName, subDef]: [string, any]) => ({
        name: `${field.name}.${subName}`,
        label: subDef.description || subName,
        type: subDef.type || 'string',
        required: subDef.required || false,
        default: subDef.default,
        description: subDef.description,
        enumValues: subDef.enum,
        hidden: subDef.hidden === true,
        readOnly: subDef['read-only'] === true,
      }))

      return { ...field, subFields }
    })
  } catch {
    return fields
  }
}

/**
 * Initialize form values from parsed fields, applying schema defaults first,
 * then overriding with provided defaults.
 */
export function initFormValues(fields: ParsedField[], defaultValues: Record<string, any> = {}): Record<string, any> {
  const values: Record<string, any> = {}
  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.name] = field.default
    } else if (field.type === 'dict' || field.type === 'object') {
      values[field.name] = {}
    } else if (field.type === 'array') {
      values[field.name] = []
    } else {
      values[field.name] = ""
    }
  }
  Object.assign(values, defaultValues)
  return values
}

/**
 * Handle a field value change, supporting dot-notation for nested dict/object fields.
 */
export function applyFieldChange(
  prev: Record<string, any>,
  name: string,
  value: any
): Record<string, any> {
  if (name.includes('.')) {
    const [parentName, ...childPath] = name.split('.')
    const childName = childPath.join('.')
    const parentValue = prev[parentName] || {}
    return {
      ...prev,
      [parentName]: {
        ...(typeof parentValue === 'object' ? parentValue : {}),
        [childName]: value,
      },
    }
  }
  return { ...prev, [name]: value }
}

/**
 * Load a connector's schema, parse it, and enrich dict fields.
 * Returns the connector object and parsed fields.
 */
export async function loadConnectorFields(
  connectorId: string,
): Promise<{ connector: any; fields: ParsedField[] }> {
  const res = await fetch('/api/e2e/tables/api_connectors?limit=100')
  if (!res.ok) throw new Error('Failed to fetch connectors')

  const data = await res.json()
  let found = data.data?.find((c: any) => c.id === connectorId)
  if (!found) {
    found = data.data?.find((c: any) => c.name.toLowerCase() === connectorId.toLowerCase())
  }

  if (!found) return { connector: null, fields: [] }

  if (!found.input_schema) return { connector: found, fields: [] }

  let schema = found.input_schema
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema) } catch { return { connector: found, fields: [] } }
  }

  const parsed = parseInputSchema(schema)
  if (!parsed || parsed.length === 0) return { connector: found, fields: [] }

  const enriched = await enrichDictFields(parsed)
  return { connector: found, fields: enriched }
}
