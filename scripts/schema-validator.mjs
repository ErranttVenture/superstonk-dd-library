import { isDeepStrictEqual } from 'node:util';

const supportedKeywords = new Set([
  '$schema',
  '$id',
  '$comment',
  '$defs',
  'title',
  'description',
  'default',
  '$ref',
  'type',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'minimum',
  'maximum',
  'minItems',
  'uniqueItems',
  'pattern',
  'anyOf',
  'allOf'
]);

function assertSupportedSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('schemas must be JSON objects');
  }

  for (const keyword of Object.keys(schema)) {
    if (!supportedKeywords.has(keyword)) {
      throw new Error(`unsupported schema keyword "${keyword}"`);
    }
  }

  if (Object.hasOwn(schema, 'additionalProperties') &&
      typeof schema.additionalProperties !== 'boolean') {
    throw new Error('schema-valued additionalProperties is unsupported');
  }

  for (const child of Object.values(schema.$defs ?? {})) {
    assertSupportedSchema(child);
  }
  for (const child of Object.values(schema.properties ?? {})) {
    assertSupportedSchema(child);
  }
  if (schema.items !== undefined) {
    assertSupportedSchema(schema.items);
  }
  for (const child of schema.anyOf ?? []) {
    assertSupportedSchema(child);
  }
  for (const child of schema.allOf ?? []) {
    assertSupportedSchema(child);
  }
}

function resolveLocalReference(reference, rootSchema) {
  if (!reference.startsWith('#/')) {
    throw new Error(`only local schema references are supported: ${reference}`);
  }

  let target = rootSchema;
  for (const encodedPart of reference.slice(2).split('/')) {
    const part = encodedPart.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!target || typeof target !== 'object' || !Object.hasOwn(target, part)) {
      throw new Error(`local schema reference not found: ${reference}`);
    }
    target = target[part];
  }
  return target;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function matchesType(type, value) {
  switch (type) {
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return Number.isInteger(value);
    case 'null':
      return value === null;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return isObject(value);
    case 'boolean':
    case 'string':
      return typeof value === type;
    default:
      throw new Error(`unsupported schema type "${type}"`);
  }
}

function propertyPath(path, property) {
  return `${path}.${property}`;
}

function visit(schema, value, path, rootSchema, errors) {
  if (schema.$ref !== undefined) {
    visit(resolveLocalReference(schema.$ref, rootSchema), value, path, rootSchema, errors);
  }

  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    errors.push({ path, message: `must be of type ${schema.type}` });
    return;
  }

  if (schema.enum !== undefined && !schema.enum.some((item) => isDeepStrictEqual(item, value))) {
    errors.push({ path, message: 'must equal one of the enum values' });
  }
  if (Object.hasOwn(schema, 'const') && !isDeepStrictEqual(schema.const, value)) {
    errors.push({ path, message: 'must equal the const value' });
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `must be greater than or equal to ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `must be less than or equal to ${schema.maximum}` });
    }
  }

  if (typeof value === 'string' && schema.pattern !== undefined) {
    if (!new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `must match pattern ${schema.pattern}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `must contain at least ${schema.minItems} items` });
    }
    if (schema.uniqueItems === true && value.some((item, index) =>
      value.slice(0, index).some((earlier) => isDeepStrictEqual(earlier, item)))) {
      errors.push({ path, message: 'must contain unique items' });
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        visit(schema.items, item, `${path}[${index}]`, rootSchema, errors);
      });
    }
  }

  if (isObject(value)) {
    for (const property of schema.required ?? []) {
      if (!Object.hasOwn(value, property)) {
        errors.push({ path, message: `missing required property "${property}"` });
      }
    }

    const properties = schema.properties ?? {};
    for (const [property, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, property)) {
        visit(
          propertySchema,
          value[property],
          propertyPath(path, property),
          rootSchema,
          errors
        );
      }
    }

    if (schema.additionalProperties === false) {
      for (const property of Object.keys(value)) {
        if (!Object.hasOwn(properties, property)) {
          errors.push({
            path: propertyPath(path, property),
            message: `unknown property "${property}"`
          });
        }
      }
    }
  }

  if (schema.anyOf !== undefined) {
    const matched = schema.anyOf.some((candidate) => {
      const candidateErrors = [];
      visit(candidate, value, path, rootSchema, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (!matched) {
      errors.push({ path, message: 'must match at least one schema in anyOf' });
    }
  }

  for (const candidate of schema.allOf ?? []) {
    visit(candidate, value, path, rootSchema, errors);
  }
}

export function validateAgainstSchema(schema, value) {
  assertSupportedSchema(schema);
  const errors = [];
  visit(schema, value, '$', schema, errors);
  return errors;
}

export function validateMasterRecords(records, recordSchema) {
  const errors = records.flatMap((record, index) =>
    validateAgainstSchema(recordSchema, record).map((error) => ({
      ...error,
      record: index + 1
    }))
  );
  return {
    valid: records.length - new Set(errors.map((error) => error.record)).size,
    total: records.length,
    errors
  };
}
