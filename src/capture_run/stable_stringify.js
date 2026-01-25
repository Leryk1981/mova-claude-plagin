function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item));
    return `[${items.join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const props = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${props.join(',')}}`;
}

module.exports = { stableStringify };
