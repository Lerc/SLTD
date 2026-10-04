#!/usr/bin/env node
// Exported image workflow. Requires Node.js 20.9+ and: npm install sharp@^0.35.4
// Usage: node workflow.mjs photo.jpg other.png --out ./output --integer_n5 320
import sharp from 'sharp';
import { mkdir, writeFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
const createEngine = function createEngine() {
  const arrays = ['Uint8Array', 'Uint8ClampedArray', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];
  const types = ['image', 'color', 'string', 'integer', 'float', 'typedArray', ...arrays, 'any'];
  const p = (name, type, value, wire = false) => ({ name, type, value, wire });
  // An image input of a multi-image node that also takes a color, filled to the size of the node's other images.
  const fill = (name, value) => ({ ...p(name, 'image', value, true), fill: true });
  // The type of a port's local (unwired) value: color for fillable image inputs.
  const localType = port => port.fill ? 'color' : port.type;
  // Color values follow CSS color(): { space, components: [c1, c2, c3], alpha }, with 1 as the channel reference range.
  const mul = (m, v) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  const matmul = (a, b) => a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
  function inverse([[a, b, c], [d, e, f], [g, h, i]]) {
    const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C;
    return [[A, c * h - b * i, b * f - c * e], [B, a * i - c * g, c * d - a * f], [C, b * g - a * h, a * e - b * d]].map(r => r.map(v => v / det));
  }
  const whiteXYZ = (x, y) => [x / y, 1, (1 - x - y) / y];
  const D65 = whiteXYZ(0.3127, 0.3290), D50 = whiteXYZ(0.3457, 0.3585);
  // Linear RGB → XYZ from primary chromaticities, scaled so RGB white maps to the reference white.
  function rgbToXYZ(primaries, white) {
    const columns = primaries.map(([x, y]) => whiteXYZ(x, y)), m = [0, 1, 2].map(i => columns.map(c => c[i])), scale = mul(inverse(m), white);
    return m.map(row => row.map((v, j) => v * scale[j]));
  }
  const bradford = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
  function adapt(from, to) { const [s, d] = [mul(bradford, from), mul(bradford, to)]; return matmul(inverse(bradford), matmul([0, 1, 2].map(i => [0, 1, 2].map(j => i === j ? d[i] / s[i] : 0)), bradford)); }
  const D50toD65 = adapt(D50, D65), D65toD50 = inverse(D50toD65);
  // Transfer functions extend to negative values by mirroring, as in CSS Color 4.
  const signed = f => v => Math.sign(v) * f(Math.abs(v));
  const srgbCurve = [signed(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), signed(v => v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : v * 12.92)];
  const r2020 = [1.09929682680944, 0.018053968510807];
  const colorSpaces = {
    'srgb': { primaries: [[0.64, 0.33], [0.3, 0.6], [0.15, 0.06]], white: D65, curve: srgbCurve },
    'srgb-linear': { primaries: [[0.64, 0.33], [0.3, 0.6], [0.15, 0.06]], white: D65 },
    'display-p3': { primaries: [[0.68, 0.32], [0.265, 0.69], [0.15, 0.06]], white: D65, curve: srgbCurve },
    'a98-rgb': { primaries: [[0.64, 0.33], [0.21, 0.71], [0.15, 0.06]], white: D65, curve: [signed(v => v ** (563 / 256)), signed(v => v ** (256 / 563))] },
    'prophoto-rgb': { primaries: [[0.734699, 0.265301], [0.159597, 0.840403], [0.036598, 0.000105]], white: D50, curve: [signed(v => v <= 16 / 512 ? v / 16 : v ** 1.8), signed(v => v >= 1 / 512 ? v ** (1 / 1.8) : v * 16)] },
    'rec2020': { primaries: [[0.708, 0.292], [0.17, 0.797], [0.131, 0.046]], white: D65, curve: [signed(v => v < r2020[1] * 4.5 ? v / 4.5 : ((v + r2020[0] - 1) / r2020[0]) ** (1 / 0.45)), signed(v => v > r2020[1] ? r2020[0] * v ** 0.45 - (r2020[0] - 1) : v * 4.5)] },
    'xyz': { white: D65 }, 'xyz-d50': { white: D50 }, 'xyz-d65': { white: D65 },
  };
  for (const space of Object.values(colorSpaces)) {
    // Every space converts to and from XYZ D65, adapting D50 spaces with Bradford.
    const toXYZ = space.primaries ? rgbToXYZ(space.primaries, space.white) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    space.toD65 = space.white === D50 ? matmul(D50toD65, toXYZ) : toXYZ;
    space.fromD65 = inverse(space.toD65);
  }
  const colorSpaceNames = Object.keys(colorSpaces);
  function convertColor(color, space) {
    const from = colorSpaces[color.space], to = colorSpaces[space];
    if (!to) throw Error(`Unknown color space ${space}`);
    if (color.space === space) return { space, components: [...color.components], alpha: color.alpha };
    const linear = from.curve ? color.components.map(from.curve[0]) : color.components;
    const target = mul(to.fromD65, mul(from.toD65, linear));
    return { space, components: to.curve ? target.map(to.curve[1]) : target, alpha: color.alpha };
  }
  const cssColor = c => `color(${c.space} ${c.components.map(v => +v.toFixed(6)).join(' ')}${c.alpha === 1 ? '' : ` / ${+c.alpha.toFixed(6)}`})`;
  function parseColor(text) {
    const source = text.trim(), hex = source.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      const digits = hex[1].length <= 4 ? [...hex[1]].map(d => d + d) : hex[1].match(/../g), v = digits.map(d => parseInt(d, 16) / 255);
      return { space: 'srgb', components: v.slice(0, 3), alpha: v[3] ?? 1 };
    }
    const match = source.match(/^color\(\s*([a-z0-9-]+)\s+([^/)]+?)\s*(?:\/\s*([^)]+?)\s*)?\)$/i);
    if (!match) return null;
    const number = v => v === 'none' ? 0 : /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?%$/i.test(v) ? Number(v.slice(0, -1)) / 100 : /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v) ? Number(v) : NaN;
    const components = match[2].split(/\s+/).map(number), alpha = match[3] === undefined ? 1 : number(match[3]);
    if (!colorSpaces[match[1].toLowerCase()] || components.length !== 3 || [...components, alpha].some(Number.isNaN)) return null;
    return { space: match[1].toLowerCase(), components, alpha: Math.min(1, Math.max(0, alpha)) };
  }
  const kernelTypes = ['xy', 'x', 'y', 'xy mirrored', 'x mirrored', 'y mirrored'];
  const alphaModes = ['replace', 'multiply', 'replace (grey × alpha)', 'multiply (grey × alpha)'];
  // Command-line options of exported scripts; CLI parameter names cannot reuse them.
  const reservedOptions = ['out', 'help', 'force-overwrite'];
  // Output filename templates. The numbered form is the original naming; a sole Output starts with the source name.
  const filenameTokens = ['name', 'stem', 'ext', 'index', 'id', 'type'], numberedTemplate = '{index}-{stem}-{id}.{type}', sourceTemplate = '{name}';
  function checkFilenameTemplate(template) {
    if (typeof template !== 'string' || !template.trim()) throw Error('The filename template cannot be empty');
    for (const [, token] of template.matchAll(/\{([^}]*)\}/g)) if (!filenameTokens.includes(token)) throw Error(`Unknown filename token {${token}}; use ${filenameTokens.map(t => `{${t}}`).join(' ')}`);
  }
  // Render a template for one result: file is the source file name ('' without one), index is 0-based.
  function outputFilename(template, { file = '', index = 0, id = '', image = true }) {
    checkFilenameTemplate(template);
    const type = image ? 'png' : 'json', name = file || `data.${type}`, dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot + 1) : '';
    const values = { name, stem, ext, index: String(index + 1).padStart(3, '0'), id: String(id).replace(/[^a-zA-Z0-9_-]/g, '_'), type };
    let result = template.trim().replace(/\{(\w+)\}/g, (_, token) => values[token]);
    // Data results are always JSON, whatever extension the template produced.
    if (!image && !/\.json$/i.test(result)) result = result.replace(/\.[^./\\]*$/, '') + '.json';
    const parts = result.split(/[\\/]+/);
    if (/^[\\/]/.test(result) || /^[A-Za-z]:/.test(result) || parts.some(part => !part || part === '.' || part === '..')) throw Error(`The filename "${result}" must be a relative path without empty, . or .. parts`);
    return parts.join('/');
  }
  const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'add', 'subtract', 'difference'];
  const catalog = {
    image: { title: 'Batch image', category: 'Inputs', icon: '▧', description: 'An image from your input batch', inputs: [], outputs: [p('image', 'image'), p('filename', 'string')] },
    string: { title: 'String', category: 'Inputs', icon: 'T', description: 'Text or a command-line parameter', inputs: [], outputs: [p('value', 'string')] },
    integer: { title: 'Integer', category: 'Inputs', icon: '#', description: 'A whole-number parameter', inputs: [], outputs: [p('value', 'integer')] },
    float: { title: 'Float', category: 'Inputs', icon: '∿', description: 'A decimal-number parameter', inputs: [], outputs: [p('value', 'float')] },
    generate: { title: 'Generate image', category: 'Inputs', icon: '▭', description: 'A solid RGBA image of any size', inputs: [p('width', 'integer', 640), p('height', 'integer', 480), p('fill', 'color', '#ffffff')], outputs: [p('image', 'image')] },
    array: { title: 'Typed array', category: 'Inputs', icon: '[ ]', description: 'Numeric data with an explicit element type', inputs: [], outputs: [p('value', 'Uint8Array')] },
    resize: { title: 'Resize', category: 'Transform', icon: '⤢', description: 'Set the width and height in pixels', inputs: [p('image', 'image', null, true), p('width', 'integer', 640), p('height', 'integer', 480)], outputs: [p('image', 'image')] },
    crop: { title: 'Crop', category: 'Transform', icon: '⌗', description: 'Extract a rectangle, then add padding in a color', inputs: [p('image', 'image', null, true), p('x', 'integer', 0), p('y', 'integer', 0), p('width', 'integer', 320), p('height', 'integer', 240), p('padAbove', 'integer', 0), p('padBelow', 'integer', 0), p('padLeft', 'integer', 0), p('padRight', 'integer', 0), p('padColor', 'color', '#00000000')], outputs: [p('image', 'image')] },
    rotate: { title: 'Rotate', category: 'Transform', icon: '↻', description: 'Rotate clockwise in quarter turns', inputs: [p('image', 'image', null, true), p('turns', 'integer', 1)], outputs: [p('image', 'image')] },
    tone: { title: 'Color adjustment', category: 'Color', icon: '◐', description: 'Fine-tune brightness, contrast and saturation', inputs: [p('image', 'image', null, true), p('brightness', 'float', 1.08), p('contrast', 'float', 1.05), p('saturation', 'float', 0.85)], outputs: [p('image', 'image')] },
    hsl: { title: 'HSL adjustment', category: 'Color', icon: '◍', description: 'Shift hue (degrees), scale saturation, lighten or darken (−1 to 1)', inputs: [p('image', 'image', null, true), p('hue', 'float', 0), p('saturation', 'float', 1), p('lightness', 'float', 0)], outputs: [p('image', 'image')] },
    threshold: { title: 'Threshold', category: 'Color', icon: '◧', description: 'White where luminance is in low–high (0–255), black outside', inputs: [p('image', 'image', null, true), p('low', 'integer', 128), p('high', 'integer', 255)], outputs: [p('image', 'image')] },
    posterize: { title: 'Posterise', category: 'Color', icon: '▤', description: 'Limit each color channel to a number of levels', inputs: [p('image', 'image', null, true), p('levels', 'integer', 4)], outputs: [p('image', 'image')] },
    colorRange: { title: 'Select color range', category: 'Color', icon: '◎', description: 'White image masked by closeness to a color', inputs: [p('image', 'image', null, true), p('color', 'color', '#ffffff'), p('tolerance', 'float', 32), p('softness', 'float', 16)], outputs: [p('mask', 'image')] },
    setAlpha: { title: 'Alpha channel', category: 'Color', icon: '▨', description: 'Set or multiply the alpha from a grey image', inputs: [fill('image', '#ffffff'), fill('alpha', '#ffffff'), { ...p('mode', 'string', 'replace'), options: alphaModes }], outputs: [p('image', 'image')] },
    splitChannels: { title: 'Split channels', category: 'Color', icon: '≡', description: 'Each RGBA channel as an opaque grayscale image', inputs: [p('image', 'image', null, true)], outputs: [p('red', 'image'), p('green', 'image'), p('blue', 'image'), p('alpha', 'image')] },
    mergeChannels: { title: 'Assemble channels', category: 'Color', icon: '⊞', description: 'Build RGBA from one image per channel', inputs: [fill('red', '#000000'), fill('green', '#000000'), fill('blue', '#000000'), fill('alpha', '#ffffff')], outputs: [p('image', 'image')] },
    grayscale: { title: 'Grayscale', category: 'Color', icon: '◑', description: 'Convert color to luminance', inputs: [p('image', 'image', null, true)], outputs: [p('image', 'image')] },
    invert: { title: 'Invert', category: 'Color', icon: '◒', description: 'Invert RGB color channels', inputs: [p('image', 'image', null, true)], outputs: [p('image', 'image')] },
    makeColor: { title: 'Color from values', category: 'Data & logic', icon: '●', description: 'Build a color from CSS color() channels', inputs: [{ ...p('space', 'string', 'srgb'), options: colorSpaceNames }, p('c1', 'float', 1), p('c2', 'float', 0.5), p('c3', 'float', 0), p('alpha', 'float', 1)], outputs: [p('color', 'color')] },
    splitColor: { title: 'Separate color', category: 'Data & logic', icon: '◔', description: 'Channel values of a color in a chosen space', inputs: [p('color', 'color', null, true), { ...p('space', 'string', 'srgb'), options: colorSpaceNames }], outputs: [p('c1', 'float'), p('c2', 'float'), p('c3', 'float'), p('alpha', 'float')] },
    blur: { title: 'Gaussian blur', category: 'Filter', icon: '◌', description: 'Soften with a Gaussian of the given sigma (pixels)', inputs: [p('image', 'image', null, true), p('sigma', 'float', 2)], outputs: [p('image', 'image')] },
    kernel: { title: 'Kernel filter', category: 'Filter', icon: '⊡', description: 'Convolve RGB with a kernel; alpha is kept', inputs: [p('image', 'image', null, true), p('kernel', 'typedArray', '[1, 2, 2, 4]'), { ...p('type', 'string', 'xy mirrored'), options: kernelTypes }, p('divisor', 'float', 16), p('offset', 'float', 0)], outputs: [p('image', 'image')] },
    composite: { title: 'Composite', category: 'Filter', icon: '◫', description: 'Blend B over A, through the mask if connected', inputs: [fill('a', '#000000'), fill('b', '#ffffff'), { ...fill('mask', '#ffffff'), optional: true }, { ...p('mode', 'string', 'normal'), options: blendModes }], outputs: [p('image', 'image')] },
    histogram: { title: 'Histogram', category: 'Data & logic', icon: '▅', description: 'Count pixel values per channel (0–255)', inputs: [p('image', 'image', null, true)], outputs: [p('plot', 'image'), p('red', 'Uint32Array'), p('green', 'Uint32Array'), p('blue', 'Uint32Array'), p('luminance', 'Uint32Array')] },
    pixels: { title: 'Image → pixels', category: 'Data & logic', icon: '⠿', description: 'Read RGBA bytes and image dimensions', inputs: [p('image', 'image', null, true)], outputs: [p('pixels', 'Uint8ClampedArray'), p('width', 'integer'), p('height', 'integer')] },
    compose: { title: 'Pixels → image', category: 'Data & logic', icon: '▦', description: 'Build an image from RGBA bytes', inputs: [p('pixels', 'typedArray', null, true), p('width', 'integer', 640), p('height', 'integer', 480)], outputs: [p('image', 'image')] },
    expression: { title: 'Expression', category: 'Data & logic', icon: '=', description: 'A JavaScript expression of a and b; errors give 0', inputs: [{ ...p('a', 'any', null, true), optional: true }, { ...p('b', 'any', null, true), optional: true }, p('expression', 'string', 'a * b')], outputs: [p('value', 'float'), p('error', 'string')] },
    concat: { title: 'Join strings', category: 'Data & logic', icon: '≋', description: 'Combine two strings', inputs: [p('a', 'string', ''), p('b', 'string', '')], outputs: [p('value', 'string')] },
    custom: { title: 'JavaScript function', category: 'Data & logic', icon: 'ƒ', description: 'Your own function with a typed interface', inputs: [p('image', 'image', null, true), p('amount', 'float', 1)], outputs: [p('image', 'image')] },
    display: { title: 'Output', category: 'Outputs', icon: '▣', description: 'Preview an image or data; saved as the filename template', inputs: [p('result', 'any', null, true), { ...p('filename', 'string', numberedTemplate), template: true }], outputs: [] },
    view: { title: 'View', category: 'Outputs', icon: '◉', description: 'Preview an image or data and pass it on unchanged; exported scripts skip the preview', inputs: [p('result', 'any', null, true)], outputs: [p('result', 'any')] },
  };
  function schema(node) {
    const base = catalog[node.kind];
    if (!base) throw Error(`Unknown node: ${node.kind}`);
    if (node.kind === 'custom') return { ...base, inputs: node.config.inputs, outputs: node.config.outputs };
    if (node.kind === 'array') return { ...base, outputs: [p('value', node.config.arrayType)] };
    return base;
  }
  function makeNode(kind, id, x = 0, y = 0) {
    if (!catalog[kind]) throw Error('Unknown node kind');
    const config = kind === 'custom' ? { inputs: catalog.custom.inputs, outputs: catalog.custom.outputs, code: 'const data = new Uint8ClampedArray(image.data);\nfor (let i = 0; i < data.length; i += 4) {\n  data[i] *= amount;\n}\nreturn { image: { ...image, data } };' } : { value: kind === 'string' ? 'hello' : kind === 'array' ? '[0, 128, 255]' : kind === 'integer' ? 640 : 1, variable: `${kind}_${id}`, arrayType: 'Uint8Array' };
    return { id, kind, title: catalog[kind].title, x, y, config: structuredClone(config), params: Object.fromEntries(catalog[kind].inputs.map(v => [v.name, { mode: v.wire ? 'wire' : 'value', value: v.value }])) };
  }
  // `to` is an input port or a type name; colors connect to fillable image inputs.
  // An 'any' output (such as a View passing its input on) connects anywhere; its value is checked when the input receives it.
  const compatible = (from, to) => { const type = to?.type ?? to; return type === 'any' || from === 'any' || from === type || (from === 'integer' && type === 'float') || (arrays.includes(from) && type === 'typedArray') || (from === 'color' && type === 'image' && !!to?.fill); };
  function cast(value, type) {
    if (type === 'string') return String(value);
    if (type === 'color') {
      const color = typeof value === 'string' ? parseColor(value) : value;
      if (!color || !colorSpaces[color.space] || !Array.isArray(color.components)) throw Error('Expected a color such as #ff8000 or color(display-p3 1 0.5 0 / 0.8)');
      return { space: color.space, components: color.components.map(Number), alpha: color.alpha === undefined ? 1 : Number(color.alpha) };
    }
    if (type === 'integer' || type === 'float') {
      if (value === '' || value === null) throw Error(`Enter a ${type}`);
      const n = Number(value);
      if (!Number.isFinite(n) || (type === 'integer' && !Number.isSafeInteger(n))) throw Error(`Expected a valid ${type}`);
      return n;
    }
    if (arrays.includes(type)) {
      const values = typeof value === 'string' ? JSON.parse(value) : value;
      if (!Array.isArray(values) && !ArrayBuffer.isView(values)) throw Error('Expected a JSON array');
      return new globalThis[type](Array.from(values, v => type.startsWith('Big') ? BigInt(v) : cast(v, 'float')));
    }
    if (type === 'typedArray') {
      if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return value;
      // A local value has no element type of its own, so it becomes a Float64Array.
      return cast(value, 'Float64Array');
    }
    return value;
  }
  // Local parameter values may be expressions over the node's other inputs and the Math statics.
  const mathScope = Object.fromEntries(Object.getOwnPropertyNames(Math).map(name => [name, Math[name]]));
  function isExpression(value, type) {
    if (typeof value !== 'string' || !value.trim()) return false;
    if (type === 'integer' || type === 'float') return !Number.isFinite(Number(value));
    if (arrays.includes(type) || type === 'typedArray') { try { JSON.parse(value); return false; } catch { return true; } }
    if (type === 'color') return !parseColor(value);
    return false;
  }
  function evaluateExpression(source, scope = {}) {
    const names = [...new Set([...Object.keys(mathScope), ...Object.keys(scope)])], values = { ...mathScope, ...scope };
    return new Function(...names, '"use strict";\nreturn (\n' + source + '\n);')(...names.map(n => values[n]));
  }
  // Check a local value without running it: expressions are compiled, literals are cast.
  function checkLocal(value, type) {
    if (!isExpression(value, type)) return cast(value, type);
    try { new Function(...Object.keys(mathScope), '"use strict";\nreturn (\n' + value + '\n);'); } catch (e) { throw Error(`Invalid expression: ${e.message}`); }
  }
  const isColorValue = v => !!v && typeof v === 'object' && typeof v.space === 'string' && Array.isArray(v.components);
  const valueType = (port, value) => port.fill && isColorValue(value) ? 'color' : port.type;
  // Replace colors on fillable inputs with solid images sized like the first real image among them.
  function fillColors(args, names) {
    const reference = names.map(n => args[n]).find(v => v !== undefined && !isColorValue(v));
    if (!reference) throw Error(`Connect an image to at least one of ${names.join(', ')} to set the size`);
    for (const n of names) if (isColorValue(args[n])) {
      const rgba = rgba8(args[n]), data = new Uint8ClampedArray(reference.width * reference.height * 4);
      for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
      args[n] = { width: reference.width, height: reference.height, data };
    }
    return args;
  }
  function assertValue(value, type, context) {
    let ok = type === 'any' ? value !== undefined : type === 'image' ? value && Number.isSafeInteger(value.width) && Number.isSafeInteger(value.height) && value.width > 0 && value.height > 0 && value.data instanceof Uint8ClampedArray && value.data.length === value.width * value.height * 4 : type === 'integer' ? Number.isSafeInteger(value) : type === 'float' ? typeof value === 'number' && Number.isFinite(value) : type === 'string' ? typeof value === 'string' : type === 'color' ? !!value && !!colorSpaces[value.space] && Array.isArray(value.components) && value.components.length === 3 && value.components.every(Number.isFinite) && Number.isFinite(value.alpha) && value.alpha >= 0 && value.alpha <= 1 : type === 'typedArray' ? ArrayBuffer.isView(value) && !(value instanceof DataView) : arrays.includes(type) && value instanceof globalThis[type];
    if (!ok) throw Error(`${context}: expected ${type}`);
  }
  // Bring workflows saved by earlier versions up to the current node interfaces.
  function upgrade(graph) {
    if (!Array.isArray(graph?.nodes) || !Array.isArray(graph.edges)) return graph;
    const legacy = { generate: ['fill', ['red', 'green', 'blue', 'alpha']], colorRange: ['color', ['red', 'green', 'blue']] };
    for (const node of graph.nodes) {
      // Display output was renamed Output; keep titles the user chose.
      if (node.kind === 'display' && node.title === 'Display output') node.title = 'Output';
      // Composite's alpha input was renamed mask.
      if (node.kind === 'composite' && node.params?.alpha && !node.params.mask) {
        const { alpha, ...rest } = node.params;
        node.params = { ...rest, mask: alpha };
        graph.edges.forEach(e => { if (e.to === node.id && e.input === 'alpha') e.input = 'mask'; });
        continue;
      }
      // Threshold's single level became a low–high range; level maps to low with the full upper range.
      if (node.kind === 'threshold' && node.params?.level && !node.params.low) {
        const { level, ...rest } = node.params;
        node.params = { ...rest, low: level, high: { mode: 'value', value: 255 } };
        graph.edges.forEach(e => { if (e.to === node.id && e.input === 'level') e.input = 'low'; });
        continue;
      }
      // Multiply became Expression: local a/b values move into the expression text and the inputs become wires.
      if (node.kind === 'math' && node.params) {
        const operand = name => { const param = node.params[name]; if (!param || param.mode === 'wire') return name; const v = String(param.value ?? 0).trim(); return Number.isFinite(Number(v)) && v !== '' ? v : `(${v})`; };
        node.kind = 'expression'; if (node.title === 'Multiply') node.title = 'Expression';
        node.params = { a: { mode: 'wire', value: null }, b: { mode: 'wire', value: null }, expression: { mode: 'value', value: `${operand('a')} * ${operand('b')}` } };
        continue;
      }
      const [port, channels] = legacy[node.kind] || [];
      if (!port || node.params?.[port] || !channels.every(c => node.params?.[c])) continue;
      // Literal 0–255 channels become a hex color; wired or expression channels cannot carry over, so they reset to white.
      const values = channels.map(c => node.params[c].mode === 'value' ? Number(node.params[c].value) : NaN);
      const literal = values.every(v => Number.isInteger(v) && v >= 0 && v <= 255);
      node.params[port] = { mode: 'value', value: literal ? '#' + values.map(v => v.toString(16).padStart(2, '0')).join('') : '#ffffff' };
      channels.forEach(c => delete node.params[c]);
      graph.edges = graph.edges.filter(e => !(e.to === node.id && channels.includes(e.input)));
    }
    // Inputs added to built-in nodes later start at their catalog defaults.
    for (const node of graph.nodes) {
      if (!catalog[node.kind] || node.kind === 'custom' || !node.params || typeof node.params !== 'object') continue;
      for (const port of catalog[node.kind].inputs) node.params[port.name] ??= { mode: port.wire ? 'wire' : 'value', value: port.value };
    }
    return graph;
  }
  function validate(graph) {
    if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw Error('Not a supported workflow (version 1)');
    if (graph.nodes.length > 200 || graph.edges.length > 2000) throw Error('Workflow is too large');
    const ids = new Set(), variables = new Set();
    for (const node of graph.nodes) {
      if (typeof node.id !== 'string' || ids.has(node.id)) throw Error('Node IDs must be unique strings');
      ids.add(node.id);
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || typeof node.title !== 'string' || !node.config || !node.params) throw Error('Invalid node data');
      if (['string', 'integer', 'float', 'array'].includes(node.kind)) {
        const name = node.config.variable;
        if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name) || reservedOptions.includes(name) || variables.has(name)) throw Error(`CLI parameter names must be unique and cannot be ${reservedOptions.join(', ')}`);
        variables.add(name);
      }
      if (node.kind === 'array' && !arrays.includes(node.config.arrayType)) throw Error('Select a concrete typed array element type');
      const spec = schema(node);
      for (const ports of [spec.inputs, spec.outputs]) {
        if (!Array.isArray(ports) || ports.length > 24) throw Error('Invalid function ports');
        const names = new Set();
        for (const port of ports) {
          if (!/^[A-Za-z_$][\w$]*$/.test(port.name) || ['__proto__', 'constructor', 'prototype'].includes(port.name) || names.has(port.name) || !types.includes(port.type)) throw Error('Invalid or duplicate port name/type');
          names.add(port.name);
        }
      }
      for (const port of spec.inputs) {
        const param = node.params[port.name];
        if (!['wire', 'value'].includes(param?.mode)) throw Error(`Invalid parameter ${port.name}`);
        if (param.mode === 'value' && port.template) try { checkFilenameTemplate(param.value); } catch (e) { throw Error(`${node.title}.${port.name}: ${e.message}`); }
        if (param.mode === 'value' && port.options && !port.options.includes(param.value)) throw Error(`${node.title}.${port.name}: choose one of ${port.options.join(', ')}`);
        if (param.mode === 'value' && isExpression(param.value, localType(port))) try { checkLocal(param.value, localType(port)); } catch (e) { throw Error(`${node.title}.${port.name}: ${e.message}`); }
      }
      if (node.kind === 'custom') {
        if (typeof node.config.code !== 'string') throw Error('Missing function body');
        new Function(...spec.inputs.map(p => p.name), '"use strict";\n' + node.config.code);
      }
    }
    const targets = new Set();
    for (const edge of graph.edges) {
      const from = graph.nodes.find(n => n.id === edge.from), to = graph.nodes.find(n => n.id === edge.to);
      if (!from || !to) throw Error('Connection references a missing node');
      const output = schema(from).outputs.find(p => p.name === edge.output), input = schema(to).inputs.find(p => p.name === edge.input);
      if (!output || !input || !compatible(output.type, input)) throw Error('Incompatible connection types');
      const key = `${edge.to}:${edge.input}`;
      if (targets.has(key)) throw Error('Only one wire is allowed per input');
      targets.add(key);
      if (to.params[edge.input].mode !== 'wire') throw Error('A connected input must be in wire mode');
    }
    const visiting = new Set(), done = new Set();
    function visit(id) {
      if (visiting.has(id)) throw Error('This connection would create a cycle');
      if (done.has(id)) return;
      visiting.add(id);
      graph.edges.filter(e => e.to === id).forEach(e => visit(e.from));
      visiting.delete(id); done.add(id);
    }
    graph.nodes.forEach(n => visit(n.id));
    return graph;
  }
  function connect(graph, edge) {
    const next = structuredClone(graph);
    next.edges = next.edges.filter(e => !(e.to === edge.to && e.input === edge.input));
    const target = next.nodes.find(n => n.id === edge.to);
    if (!target?.params[edge.input]) throw Error('Missing input');
    target.params[edge.input].mode = 'wire';
    next.edges.push(edge);
    return validate(next);
  }
  // Output ('display') and View nodes end a workflow; only Outputs are saved by exported scripts.
  // A View also passes its input on, so it can sit mid-chain; it is then evaluated like any upstream node.
  const terminalKinds = ['display', 'view'];
  function reachableNodes(graph, kinds = terminalKinds) {
    const ids = new Set();
    function visit(id) {
      if (ids.has(id)) return;
      ids.add(id);
      graph.edges.filter(e => e.to === id).forEach(e => visit(e.from));
    }
    graph.nodes.filter(n => kinds.includes(n.kind)).forEach(n => visit(n.id));
    return graph.nodes.filter(n => ids.has(n.id));
  }
  function size(w, h) {
    if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1 || w * h > 40_000_000) throw Error('Image dimensions must be positive integers, up to 40 million pixels');
  }
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Images are 8-bit sRGB: out-of-gamut colors clip per channel.
  const rgba8 = color => [...convertColor(color, 'srgb').components, color.alpha].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
  function blur(src, sigma) {
    if (!Number.isFinite(sigma) || sigma < 0 || sigma > 100) throw Error('Sigma must be between 0 and 100');
    const { width: w, height: h } = src;
    if (sigma === 0) return { width: w, height: h, data: new Uint8ClampedArray(src.data) };
    const radius = Math.ceil(sigma * 3), kernel = new Float64Array(radius * 2 + 1);
    let total = 0;
    for (let i = -radius; i <= radius; i++) total += kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.forEach((k, i) => { kernel[i] = k / total; });
    // Blur premultiplied colors so transparent pixels do not darken their neighbours; edges clamp.
    let buf = new Float64Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const a = src.data[i * 4 + 3] / 255; buf[i * 4] = src.data[i * 4] * a; buf[i * 4 + 1] = src.data[i * 4 + 1] * a; buf[i * 4 + 2] = src.data[i * 4 + 2] * a; buf[i * 4 + 3] = src.data[i * 4 + 3]; }
    for (const horizontal of [true, false]) {
      const out = new Float64Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        for (let k = -radius; k <= radius; k++) {
          const sx = horizontal ? Math.min(w - 1, Math.max(0, x + k)) : x, sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + k)), i = (sy * w + sx) * 4, weight = kernel[k + radius];
          out[o] += buf[i] * weight; out[o + 1] += buf[i + 1] * weight; out[o + 2] += buf[i + 2] * weight; out[o + 3] += buf[i + 3] * weight;
        }
      }
      buf = out;
    }
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const a = buf[i * 4 + 3], scale = a > 0 ? 255 / a : 0; data[i * 4] = buf[i * 4] * scale; data[i * 4 + 1] = buf[i * 4 + 1] * scale; data[i * 4 + 2] = buf[i * 4 + 2] * scale; data[i * 4 + 3] = a; }
    return { width: w, height: h, data };
  }
  // Expand a kernel array into a full width × height grid of weights.
  // "x"/"y" are 1-D, "xy" is square; "mirrored" arrays hold the half (1-D) or top-left quadrant (2-D) ending at the centre,
  // reflected without repeating the centre: n values → 2n − 1 wide, a k × k quadrant → (2k − 1)².
  function expandKernel(values, type) {
    const words = String(type).trim().toLowerCase().split(/\s+/), axes = words.filter(w => ['x', 'y', 'xy'].includes(w)), mirrored = words.includes('mirrored');
    if (axes.length !== 1 || words.some(w => !['x', 'y', 'xy', 'mirrored'].includes(w))) throw Error(`Kernel type must be x, y or xy, optionally followed by mirrored (got "${type}")`);
    const k = Array.from(values, Number), n = k.length, axis = axes[0];
    if (!n || n > 10000 || !k.every(Number.isFinite)) throw Error('Kernel must hold 1 to 10000 finite numbers');
    const reflect = (i, half) => i < half ? i : 2 * half - 2 - i;
    if (axis !== 'xy') {
      if (!mirrored && n % 2 === 0) throw Error(`An ${axis} kernel needs an odd number of values (got ${n})`);
      const size = mirrored ? 2 * n - 1 : n, weights = Float64Array.from({ length: size }, (_, i) => k[mirrored ? reflect(i, n) : i]);
      return axis === 'x' ? { width: size, height: 1, weights } : { width: 1, height: size, weights };
    }
    const side = Math.round(Math.sqrt(n));
    if (side * side !== n) throw Error(`An xy kernel needs a square number of values (got ${n})`);
    if (!mirrored && side % 2 === 0) throw Error(`An xy kernel needs an odd width such as 3 × 3 (got ${side} × ${side})`);
    const size = mirrored ? 2 * side - 1 : side, weights = new Float64Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) weights[y * size + x] = mirrored ? k[reflect(y, side) * side + reflect(x, side)] : k[y * size + x];
    return { width: size, height: size, weights };
  }
  // Correlate RGB with the kernel as written (edges extend), then divide and offset; alpha is kept.
  function convolve(src, kernel, divisor, offset) {
    if (!Number.isFinite(divisor) || divisor === 0) throw Error('Divisor must be a non-zero number');
    const { width: w, height: h, data: d } = src, { width: kw, height: kh, weights } = kernel, cx = kw >> 1, cy = kh >> 1, data = new Uint8ClampedArray(d);
    const taps = [];
    for (let j = 0; j < kh; j++) for (let i = 0; i < kw; i++) if (weights[j * kw + i]) taps.push([i - cx, j - cy, weights[j * kw + i] / divisor]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (const [dx, dy, weight] of taps) {
        const i = (Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))) * 4;
        r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight;
      }
      const o = (y * w + x) * 4; data[o] = r + offset; data[o + 1] = g + offset; data[o + 2] = b + offset;
    }
    return { width: w, height: h, data };
  }
  function histogram(src) {
    const red = new Uint32Array(256), green = new Uint32Array(256), blue = new Uint32Array(256), luminance = new Uint32Array(256), d = src.data;
    for (let i = 0; i < d.length; i += 4) { red[d[i]]++; green[d[i + 1]]++; blue[d[i + 2]]++; luminance[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++; }
    // Plot the RGB counts additively on black, scaled to the tallest bin.
    const pw = 256, ph = 128, data = new Uint8ClampedArray(pw * ph * 4), peak = Math.max(1, ...red, ...green, ...blue);
    for (let x = 0; x < pw; x++) {
      const bars = [red[x], green[x], blue[x]].map(n => Math.round(n / peak * ph));
      for (let y = 0; y < ph; y++) { const o = (y * pw + x) * 4, level = ph - y; for (let c = 0; c < 3; c++) data[o + c] = bars[c] >= level ? 255 : 0; data[o + 3] = 255; }
    }
    return { plot: { width: pw, height: ph, data }, red, green, blue, luminance };
  }
  const blendFns = {
    normal: (a, b) => b, multiply: (a, b) => a * b, screen: (a, b) => a + b - a * b,
    overlay: (a, b) => a <= 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b), darken: Math.min, lighten: Math.max,
    add: (a, b) => Math.min(1, a + b), subtract: (a, b) => Math.max(0, a - b), difference: (a, b) => Math.abs(a - b),
  };
  // W3C compositing: blend B's color with A where A is opaque, then source-over using B's alpha × mask alpha.
  function composite(A, B, M, mode) {
    const blend = blendFns[mode];
    if (!blend) throw Error(`Unknown blend mode ${mode}`);
    const { width: w, height: h } = A, data = new Uint8ClampedArray(w * h * 4);
    // Without a mask, B's own alpha alone decides its effect.
    const alphaAt = (img, x, y) => !img ? 1 : x < img.width && y < img.height ? img.data[(y * img.width + x) * 4 + 3] / 255 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, aa = A.data[o + 3] / 255, ab = alphaAt(B, x, y) * alphaAt(M, x, y), ao = ab + aa * (1 - ab);
      data[o + 3] = ao * 255;
      if (ao === 0) continue;
      const bi = (y * B.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const ca = A.data[o + c] / 255, cb = ab > 0 ? B.data[bi + c] / 255 : 0, mixed = (1 - aa) * cb + aa * blend(ca, cb);
        data[o + c] = (mixed * ab + ca * aa * (1 - ab)) / ao * 255;
      }
    }
    return { width: w, height: h, data };
  }
  // Surround an image with pixels of the pad color.
  function pad(img, { padAbove: top, padBelow: bottom, padLeft: left, padRight: right, padColor }) {
    if ([top, bottom, left, right].some(v => v < 0)) throw Error('Padding cannot be negative');
    if (!(top || bottom || left || right)) return img;
    const width = img.width + left + right, height = img.height + top + bottom;
    size(width, height);
    const data = new Uint8ClampedArray(width * height * 4), rgba = rgba8(padColor);
    if (rgba.some(Boolean)) for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
    for (let y = 0; y < img.height; y++) data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), ((y + top) * width + left) * 4);
    return { width, height, data };
  }
  function transform(kind, args) {
    const src = args.image;
    if (kind === 'generate') {
      size(args.width, args.height);
      const rgba = rgba8(args.fill), data = new Uint8ClampedArray(args.width * args.height * 4);
      for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
      return { image: { width: args.width, height: args.height, data } };
    }
    if (kind === 'blur') return { image: blur(src, args.sigma) };
    if (kind === 'kernel') return { image: convolve(src, expandKernel(args.kernel, args.type), args.divisor, args.offset) };
    if (kind === 'makeColor') return { color: cast({ space: args.space, components: [args.c1, args.c2, args.c3], alpha: Math.min(1, Math.max(0, args.alpha)) }, 'color') };
    if (kind === 'splitColor') { const { components: [c1, c2, c3], alpha } = convertColor(args.color, args.space); return { c1, c2, c3, alpha }; }
    if (kind === 'histogram') return histogram(src);
    if (kind === 'composite') { fillColors(args, ['a', 'b', 'mask']); return { image: composite(args.a, args.b, args.mask, args.mode) }; }
    if (kind === 'colorRange') {
      const target = rgba8(args.color), { tolerance, softness } = args;
      if (tolerance < 0 || softness < 0) throw Error('Tolerance and softness cannot be negative');
      const data = new Uint8ClampedArray(src.data.length).fill(255);
      for (let i = 0; i < data.length; i += 4) {
        const d = Math.hypot(src.data[i] - target[0], src.data[i + 1] - target[1], src.data[i + 2] - target[2]);
        const selected = d <= tolerance ? 1 : softness > 0 ? Math.max(0, 1 - (d - tolerance) / softness) : 0;
        data[i + 3] = selected * src.data[i + 3];
      }
      return { mask: { width: src.width, height: src.height, data } };
    }
    if (kind === 'hsl') {
      const { hue, saturation, lightness } = args;
      if (saturation < 0) throw Error('Saturation cannot be negative');
      if (lightness < -1 || lightness > 1) throw Error('Lightness must be between −1 and 1');
      const data = new Uint8ClampedArray(src.data), d = src.data;
      if (hue % 360 === 0 && saturation === 1 && lightness === 0) return { image: { width: src.width, height: src.height, data } };
      for (let i = 0; i < d.length; i += 4) {
        // RGB → HSL (h in turns), adjust, then back.
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
        let l = (max + min) / 2, s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1)), h = 0;
        if (delta) h = (max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) / 6;
        h = ((h + hue / 360) % 1 + 1) % 1; s = Math.min(1, s * saturation);
        l = lightness < 0 ? l * (1 + lightness) : l + (1 - l) * lightness;
        const c = (1 - Math.abs(2 * l - 1)) * s, channel = n => { const k = (n + h * 12) % 12; return l - c / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
        data[i] = channel(0) * 255; data[i + 1] = channel(8) * 255; data[i + 2] = channel(4) * 255;
      }
      return { image: { width: src.width, height: src.height, data } };
    }
    if (kind === 'setAlpha') {
      // Brightness (Rec. 709) of the grey image becomes the alpha, optionally × the grey image's own alpha, then replaces or multiplies the source alpha.
      if (!alphaModes.includes(args.mode)) throw Error(`Mode must be one of ${alphaModes.join(', ')}`);
      fillColors(args, ['image', 'alpha']);
      const { image: img, alpha: grey } = args, masked = args.mode.includes('×'), multiply = args.mode.startsWith('multiply');
      if (grey.width !== img.width || grey.height !== img.height) throw Error(`The alpha image must be ${img.width} × ${img.height}`);
      const data = new Uint8ClampedArray(img.data), g = grey.data;
      for (let i = 0; i < data.length; i += 4) {
        let a = luma(g[i], g[i + 1], g[i + 2]) / 255;
        if (masked) a *= g[i + 3] / 255;
        if (multiply) a *= img.data[i + 3] / 255;
        data[i + 3] = a * 255;
      }
      return { image: { width: img.width, height: img.height, data } };
    }
    if (kind === 'splitChannels') {
      const planes = [0, 1, 2, 3].map(() => new Uint8ClampedArray(src.data.length));
      for (let i = 0; i < src.data.length; i += 4) for (let c = 0; c < 4; c++) { const v = src.data[i + c], d = planes[c]; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      const [red, green, blue, alpha] = planes.map(data => ({ width: src.width, height: src.height, data }));
      return { red, green, blue, alpha };
    }
    if (kind === 'mergeChannels') {
      // Each source pixel contributes max(r, g, b) × alpha: gray levels pass through and white masks give their alpha.
      fillColors(args, ['red', 'green', 'blue', 'alpha']);
      const sources = [args.red, args.green, args.blue, args.alpha], { width, height } = sources[0];
      if (sources.some(img => img.width !== width || img.height !== height)) throw Error(`Channel images must all be ${width} × ${height}`);
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 4; c++) { const d = sources[c].data; data[i + c] = Math.round(Math.max(d[i], d[i + 1], d[i + 2]) * d[i + 3] / 255); }
      return { image: { width, height, data } };
    }
    if (kind === 'threshold' || kind === 'posterize') {
      const data = new Uint8ClampedArray(src.data), d = src.data;
      if (kind === 'threshold') {
        // low ≤ luminance < high, with high ≥ 255 reaching pure white, so adjacent ranges are exact complements.
        const { low, high } = args, top = high >= 255 ? Infinity : high;
        for (let i = 0; i < d.length; i += 4) { const l = luma(d[i], d[i + 1], d[i + 2]); data[i] = data[i + 1] = data[i + 2] = l >= low && l < top ? 255 : 0; }
      } else {
        const n = args.levels;
        if (n < 2 || n > 256) throw Error('Levels must be from 2 to 256');
        for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = Math.round(Math.round(d[i + c] / 255 * (n - 1)) * 255 / (n - 1));
      }
      return { image: { width: src.width, height: src.height, data } };
    }
    if (kind === 'expression') {
      // Any failure — syntax, runtime or a non-numeric result — yields 0, with the reason on the error output.
      try {
        const result = evaluateExpression(args.expression, { a: args.a, b: args.b }), value = result === null || result === '' ? NaN : Number(result);
        if (!Number.isFinite(value)) throw Error('Result is not a finite number');
        return { value, error: '' };
      } catch (e) { return { value: 0, error: e.message }; }
    }
    if (kind === 'concat') return { value: args.a + args.b };
    if (kind === 'pixels') return { pixels: new Uint8ClampedArray(src.data), width: src.width, height: src.height };
    if (kind === 'compose') {
      size(args.width, args.height);
      if (args.pixels.length !== args.width * args.height * 4) throw Error('RGBA array length must equal width × height × 4');
      return { image: { width: args.width, height: args.height, data: Uint8ClampedArray.from(args.pixels, Number) } };
    }
    let w = src.width, h = src.height;
    const turns = ((args.turns || 0) % 4 + 4) % 4;
    if (kind === 'resize' || kind === 'crop') { w = args.width; h = args.height; }
    if (kind === 'rotate' && turns % 2) [w, h] = [h, w];
    size(w, h);
    if (kind === 'crop' && (args.x < 0 || args.y < 0 || args.x + w > src.width || args.y + h > src.height)) throw Error('Crop rectangle exceeds the source image');
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sx = x, sy = y;
      if (kind === 'resize') { sx = Math.min(src.width - 1, Math.floor(x * src.width / w)); sy = Math.min(src.height - 1, Math.floor(y * src.height / h)); }
      if (kind === 'crop') { sx += args.x; sy += args.y; }
      if (kind === 'rotate') {
        if (turns === 1) { sx = y; sy = src.height - 1 - x; }
        if (turns === 2) { sx = src.width - 1 - x; sy = src.height - 1 - y; }
        if (turns === 3) { sx = src.width - 1 - y; sy = x; }
      }
      const i = (sy * src.width + sx) * 4, o = (y * w + x) * 4;
      let r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
      if (kind === 'invert') { r = 255 - r; g = 255 - g; b = 255 - b; }
      if (kind === 'grayscale') r = g = b = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (kind === 'tone') {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const tune = v => ((l + (v - l) * args.saturation) * args.brightness - 128) * args.contrast + 128;
        r = tune(r); g = tune(g); b = tune(b);
      }
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = src.data[i + 3];
    }
    if (kind === 'crop') return { image: pad({ width: w, height: h, data }, args) };
    return { image: { width: w, height: h, data } };
  }
  async function evaluate(graph, context = {}) {
    validate(graph);
    const results = new Map(), timings = {};
    async function visit(id) {
      if (results.has(id)) return results.get(id);
      const node = graph.nodes.find(n => n.id === id), spec = schema(node), args = {}, expressions = [];
      for (const port of spec.inputs) {
        const param = node.params[port.name];
        if (param.mode === 'wire') {
          const edge = graph.edges.find(e => e.to === id && e.input === port.name);
          if (!edge && port.optional) { args[port.name] = undefined; continue; }
          if (!edge) throw Error(`${node.title}: connect the ${port.name} input`);
          // Own each input so custom functions cannot mutate a sibling branch.
          args[port.name] = structuredClone((await visit(edge.from))[edge.output]);
        } else if (isExpression(param.value, localType(port))) { expressions.push(port); continue; }
        else args[port.name] = cast(param.value, localType(port));
        assertValue(args[port.name], valueType(port, args[port.name]), `${node.title}.${port.name}`);
      }
      // Expressions see wired inputs, literal values and earlier expressions, in port order.
      for (const port of expressions) {
        try {
          const result = await evaluateExpression(node.params[port.name].value, { ...args });
          if (port.type === 'integer' && typeof result === 'number' && Number.isFinite(result) && !Number.isInteger(result)) throw Error(`expression gave ${result}; use round(), floor() or ceil() for an integer`);
          args[port.name] = cast(result, localType(port));
        }
        catch (e) { throw Error(`${node.title}.${port.name}: ${e.message}${localType(port) === 'color' ? ' (colors are written as #rrggbb or color(srgb 1 0 0))' : ''}`); }
        assertValue(args[port.name], valueType(port, args[port.name]), `${node.title}.${port.name}`);
      }
      const start = performance.now();
      let output;
      try {
        if (node.kind === 'image') output = { image: structuredClone(context.image), filename: context.filename || 'input.png' };
        else if (['string', 'integer', 'float', 'array'].includes(node.kind)) output = { value: cast(context.variables?.[node.config.variable] ?? node.config.value, spec.outputs[0].type) };
        else if (terminalKinds.includes(node.kind)) output = { result: args.result, filename: args.filename };
        else if (node.kind === 'custom') {
          output = await new Function(...spec.inputs.map(p => p.name), '"use strict";\n' + node.config.code)(...spec.inputs.map(p => args[p.name]));
        } else output = transform(node.kind, args);
        for (const port of spec.outputs) assertValue(output?.[port.name], port.type, `${node.title}.${port.name}`);
      } catch (e) { throw Error(`${node.title}: ${e.message}`); }
      timings[id] = performance.now() - start;
      results.set(id, output);
      return output;
    }
    // context.outputKinds narrows which end nodes are evaluated, e.g. Outputs only in exported scripts.
    const kinds = context.outputKinds || terminalKinds, displays = graph.nodes.filter(n => kinds.includes(n.kind));
    if (!displays.length) throw Error(kinds.includes('view') ? 'Add an Output or View node to finish your workflow' : 'Add an Output node to finish your workflow');
    for (const node of displays) await visit(node.id);
    return { results, timings, outputs: displays.map(n => ({ id: n.id, kind: n.kind, title: n.title, value: results.get(n.id).result, filename: results.get(n.id).filename })) };
  }
  return { catalog, arrays, types, reservedOptions, filenameTokens, numberedTemplate, sourceTemplate, checkFilenameTemplate, outputFilename, upgrade, localType, kernelTypes, expandKernel, colorSpaces: colorSpaceNames, convertColor, parseColor, cssColor, schema, makeNode, compatible, cast, isExpression, checkLocal, evaluateExpression, validate, connect, reachableNodes, evaluate };
};
const graph = {
  "version": 1,
  "name": "TowerMod",
  "nodes": [
    {
      "id": "n1",
      "kind": "image",
      "title": "Batch image",
      "x": -1014.0214612928887,
      "y": -836.2310144819492,
      "config": {
        "value": 1,
        "variable": "image_n1",
        "arrayType": "Uint8Array"
      },
      "params": {}
    },
    {
      "id": "n8",
      "kind": "composite",
      "title": "Composite",
      "x": 80.18634900543097,
      "y": -635.379724997078,
      "config": {
        "value": 1,
        "variable": "composite_n8",
        "arrayType": "Uint8Array"
      },
      "params": {
        "a": {
          "mode": "wire",
          "value": "#000000"
        },
        "b": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mask": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mode": {
          "mode": "value",
          "value": "multiply"
        }
      }
    },
    {
      "id": "n9",
      "kind": "display",
      "title": "Display output copy",
      "x": 749.5792739155984,
      "y": -569.1922762979009,
      "config": {
        "value": 1,
        "variable": "display_n2_n9",
        "arrayType": "Uint8Array"
      },
      "params": {
        "result": {
          "mode": "wire",
          "value": null
        },
        "filename": {
          "mode": "value",
          "value": "{stem}.{type}"
        }
      }
    },
    {
      "id": "n14",
      "kind": "crop",
      "title": "Crop",
      "x": -343.7187489991608,
      "y": -1067.0933529065715,
      "config": {
        "value": 1,
        "variable": "crop_n14",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        },
        "x": {
          "mode": "value",
          "value": "image.width/2"
        },
        "y": {
          "mode": "value",
          "value": 0
        },
        "width": {
          "mode": "value",
          "value": "image.width/2"
        },
        "height": {
          "mode": "value",
          "value": "image.height"
        },
        "padAbove": {
          "mode": "value",
          "value": 0
        },
        "padBelow": {
          "mode": "value",
          "value": 0
        },
        "padLeft": {
          "mode": "value",
          "value": "image.width/2"
        },
        "padRight": {
          "mode": "value",
          "value": 0
        },
        "padColor": {
          "mode": "value",
          "value": "#00000000"
        }
      }
    },
    {
      "id": "n15",
      "kind": "tone",
      "title": "Color adjustment",
      "x": 34.373895304572784,
      "y": -1073.4362656914357,
      "config": {
        "value": 1,
        "variable": "tone_n15",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        },
        "brightness": {
          "mode": "value",
          "value": "0.6"
        },
        "contrast": {
          "mode": "value",
          "value": "8"
        },
        "saturation": {
          "mode": "value",
          "value": "0.5"
        }
      }
    },
    {
      "id": "n10",
      "kind": "tone",
      "title": "Color adjustment",
      "x": -572.0178330242813,
      "y": -580.5073014556926,
      "config": {
        "value": 1,
        "variable": "tone_n10",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        },
        "brightness": {
          "mode": "value",
          "value": "0.7"
        },
        "contrast": {
          "mode": "value",
          "value": "3"
        },
        "saturation": {
          "mode": "value",
          "value": "1"
        }
      }
    },
    {
      "id": "n5",
      "kind": "view",
      "title": "View",
      "x": 400.4363759441992,
      "y": -1108.9926019928353,
      "config": {
        "value": 1,
        "variable": "view_n5",
        "arrayType": "Uint8Array"
      },
      "params": {
        "result": {
          "mode": "wire",
          "value": null
        }
      }
    },
    {
      "id": "n6",
      "kind": "splitChannels",
      "title": "Split channels",
      "x": -2159.366921250419,
      "y": -179.3914147058161,
      "config": {
        "value": 1,
        "variable": "splitChannels_n6",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        }
      }
    },
    {
      "id": "n7",
      "kind": "view",
      "title": "View",
      "x": -1378.0016934487014,
      "y": 52.86727382458827,
      "config": {
        "value": 1,
        "variable": "view_n7",
        "arrayType": "Uint8Array"
      },
      "params": {
        "result": {
          "mode": "wire",
          "value": null
        }
      }
    },
    {
      "id": "n11",
      "kind": "kernel",
      "title": "Kernel filter",
      "x": -1781.8070648202922,
      "y": 150.5824438730603,
      "config": {
        "value": 1,
        "variable": "kernel_n11",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        },
        "kernel": {
          "mode": "value",
          "value": "[1,1,1,1,1,1,1,1,1]"
        },
        "type": {
          "mode": "value",
          "value": "xy mirrored"
        },
        "divisor": {
          "mode": "value",
          "value": "1"
        },
        "offset": {
          "mode": "value",
          "value": 0
        }
      }
    },
    {
      "id": "n12",
      "kind": "composite",
      "title": "Composite",
      "x": -995.0293510255186,
      "y": -149.1967732074368,
      "config": {
        "value": 1,
        "variable": "composite_n12",
        "arrayType": "Uint8Array"
      },
      "params": {
        "a": {
          "mode": "wire",
          "value": "#000000"
        },
        "b": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mask": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mode": {
          "mode": "value",
          "value": "difference"
        }
      }
    },
    {
      "id": "n13",
      "kind": "view",
      "title": "View",
      "x": -706.3585475838121,
      "y": -162.73354269782416,
      "config": {
        "value": 1,
        "variable": "view_n13",
        "arrayType": "Uint8Array"
      },
      "params": {
        "result": {
          "mode": "wire",
          "value": null
        }
      }
    },
    {
      "id": "n16",
      "kind": "composite",
      "title": "Composite",
      "x": 97.85675943591184,
      "y": -187.0409780296547,
      "config": {
        "value": 1,
        "variable": "composite_n16",
        "arrayType": "Uint8Array"
      },
      "params": {
        "a": {
          "mode": "wire",
          "value": "#000000"
        },
        "b": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mask": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mode": {
          "mode": "value",
          "value": "multiply"
        }
      }
    },
    {
      "id": "n17",
      "kind": "makeColor",
      "title": "Color from values",
      "x": -210.2348718510663,
      "y": -263.0574892660689,
      "config": {
        "value": 1,
        "variable": "makeColor_n17",
        "arrayType": "Uint8Array"
      },
      "params": {
        "space": {
          "mode": "value",
          "value": "srgb"
        },
        "c1": {
          "mode": "value",
          "value": "0"
        },
        "c2": {
          "mode": "value",
          "value": "0"
        },
        "c3": {
          "mode": "value",
          "value": 0
        },
        "alpha": {
          "mode": "value",
          "value": 1
        }
      },
      "compact": true
    },
    {
      "id": "n18",
      "kind": "view",
      "title": "View",
      "x": 444.9027219615404,
      "y": -213.35902517062914,
      "config": {
        "value": 1,
        "variable": "view_n18",
        "arrayType": "Uint8Array"
      },
      "params": {
        "result": {
          "mode": "wire",
          "value": null
        }
      }
    },
    {
      "id": "n19",
      "kind": "invert",
      "title": "Invert",
      "x": -211.6983412552264,
      "y": -114.04554873838283,
      "config": {
        "value": 1,
        "variable": "invert_n19",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        }
      }
    },
    {
      "id": "n20",
      "kind": "setAlpha",
      "title": "Alpha channel",
      "x": -224.8220200405203,
      "y": 82.68356267723007,
      "config": {
        "value": 1,
        "variable": "setAlpha_n20",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "alpha": {
          "mode": "wire",
          "value": "#ffffff"
        },
        "mode": {
          "mode": "value",
          "value": "replace"
        }
      }
    },
    {
      "id": "n21",
      "kind": "threshold",
      "title": "Threshold",
      "x": -692.0620516814389,
      "y": 144.6347422239677,
      "config": {
        "value": 1,
        "variable": "threshold_n21",
        "arrayType": "Uint8Array"
      },
      "params": {
        "image": {
          "mode": "wire",
          "value": null
        },
        "low": {
          "mode": "value",
          "value": 128
        },
        "high": {
          "mode": "value",
          "value": 255
        }
      },
      "compact": true
    },
    {
      "id": "n22",
      "kind": "view",
      "title": "View",
      "x": 370.3659964101584,
      "y": -628.9135758967419,
      "config": {
        "value": 1,
        "variable": "view_n22",
        "arrayType": "Uint8Array"
      },
      "params": {
        "result": {
          "mode": "wire",
          "value": null
        }
      }
    }
  ],
  "edges": [
    {
      "from": "n1",
      "output": "image",
      "to": "n14",
      "input": "image"
    },
    {
      "from": "n14",
      "output": "image",
      "to": "n15",
      "input": "image"
    },
    {
      "from": "n15",
      "output": "image",
      "to": "n8",
      "input": "a"
    },
    {
      "from": "n1",
      "output": "image",
      "to": "n10",
      "input": "image"
    },
    {
      "from": "n10",
      "output": "image",
      "to": "n8",
      "input": "b"
    },
    {
      "from": "n15",
      "output": "image",
      "to": "n5",
      "input": "result"
    },
    {
      "from": "n15",
      "output": "image",
      "to": "n6",
      "input": "image"
    },
    {
      "from": "n6",
      "output": "alpha",
      "to": "n11",
      "input": "image"
    },
    {
      "from": "n11",
      "output": "image",
      "to": "n7",
      "input": "result"
    },
    {
      "from": "n6",
      "output": "alpha",
      "to": "n12",
      "input": "a"
    },
    {
      "from": "n12",
      "output": "image",
      "to": "n13",
      "input": "result"
    },
    {
      "from": "n7",
      "output": "result",
      "to": "n12",
      "input": "b"
    },
    {
      "from": "n16",
      "output": "image",
      "to": "n18",
      "input": "result"
    },
    {
      "from": "n20",
      "output": "image",
      "to": "n19",
      "input": "image"
    },
    {
      "from": "n19",
      "output": "image",
      "to": "n16",
      "input": "mask"
    },
    {
      "from": "n17",
      "output": "color",
      "to": "n16",
      "input": "b"
    },
    {
      "from": "n18",
      "output": "result",
      "to": "n9",
      "input": "result"
    },
    {
      "from": "n13",
      "output": "result",
      "to": "n21",
      "input": "image"
    },
    {
      "from": "n21",
      "output": "image",
      "to": "n20",
      "input": "image"
    },
    {
      "from": "n21",
      "output": "image",
      "to": "n20",
      "input": "alpha"
    },
    {
      "from": "n8",
      "output": "image",
      "to": "n22",
      "input": "result"
    },
    {
      "from": "n22",
      "output": "result",
      "to": "n16",
      "input": "a"
    }
  ]
};
const engine = createEngine();
async function main() {
const args = process.argv.slice(2), files = [], variables = {};
let out = './output', positional = false, forceOverwrite = false;
const variableNames = new Set(graph.nodes.filter(n => ['string', 'integer', 'float', 'array'].includes(n.kind)).map(n => n.config.variable));
const outputs = graph.nodes.filter(n => n.kind === 'display');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--' && !positional) { positional = true; continue; }
  if (!positional && args[i] === '--help') {
    console.log('Usage: node workflow.mjs [images…] --out ./output [--force-overwrite] [--parameter value]\n' +
      '  Each Output node saves one file per input, named by its filename template: ' + outputs.map(n => n.title + ' → ' + (n.params.filename?.mode === 'value' ? n.params.filename.value : '(wired)')).join(', ') + '\n' +
      '  --force-overwrite  allow results to replace the input images themselves\n' +
      'Parameters: ' + [...variableNames].map(n => '--' + n).join(', '));
    return;
  }
  if (!positional && args[i] === '--force-overwrite') { forceOverwrite = true; continue; }
  if (!positional && args[i].startsWith('--')) {
    const key = args[i].slice(2);
    if (key !== 'out' && !variableNames.has(key)) throw Error('Unknown option: --' + key);
    if (i + 1 >= args.length) throw Error('Missing value for --' + key);
    const value = args[++i];
    if (key === 'out') out = value; else variables[key] = value;
  } else files.push(args[i]);
}
// View nodes only preview in the editor; the script evaluates and saves Output nodes.
if (!outputs.length) throw Error('This workflow has no Output nodes, so there is nothing to save. View nodes only preview in the editor.');
if (!files.length && engine.reachableNodes(graph, ['display']).some(n => n.kind === 'image')) {
  throw Error('Provide one or more image paths. Use --help for usage.');
}
const inputs = files.length ? files : [null];
// Check every destination a fixed template can produce before processing anything, so a refused run changes nothing.
const planned = new Map();
for (const [index, file] of inputs.entries()) for (const node of outputs) {
  if (node.params.filename?.mode !== 'value') continue;
  for (const image of [true, false]) {
    const dest = join(out, engine.outputFilename(node.params.filename.value, { file: file ? basename(file) : '', index, id: node.id, image }));
    if (!forceOverwrite) for (const source of files) if (await sameFile(dest, source)) throw Error('Refusing to overwrite the source image ' + source + ' (' + node.title + ' saves ' + dest + '). Choose a different --out folder or filename template, or pass --force-overwrite to replace the originals.');
    const key = dest + (image ? '' : '#data'), other = planned.get(key);
    if (image && other && other !== node.id + ':' + index) throw Error('Two results would be saved as ' + dest + '; include {name}, {stem} or {index}, and {id} for several Outputs, in the filename templates');
    if (image) planned.set(key, node.id + ':' + index);
  }
}
sharp.cache(false);
await mkdir(out, { recursive: true });
let failed = false;
const written = new Set();
for (const [index, file] of inputs.entries()) {
  try {
    let image;
    if (file) {
      const { data, info } = await sharp(file, { limitInputPixels: 40000000 }).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      image = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
    }
    const result = await engine.evaluate(graph, { image, filename: file ? basename(file) : '', variables, outputKinds: ['display'] });
    for (const output of result.outputs) {
      const value = output.value, isImage = value?.data instanceof Uint8ClampedArray && Number.isInteger(value.width) && Number.isInteger(value.height);
      const dest = join(out, engine.outputFilename(output.filename, { file: file ? basename(file) : '', index, id: output.id, image: isImage }));
      // Wired templates are only known now, so check them again here.
      if (written.has(dest)) throw Error('Two results would be saved as ' + dest + '; make the filename templates distinct');
      if (!forceOverwrite) for (const source of files) if (await sameFile(dest, source)) throw Error('Refusing to overwrite the source image ' + source + '; pass --force-overwrite to replace it');
      written.add(dest);
      await mkdir(dirname(dest), { recursive: true });
      if (isImage) {
        const encoded = sharp(Buffer.from(value.data), { raw: { width: value.width, height: value.height, channels: 4 } });
        await replaceFile(dest, temp => encodeAs(encoded, extname(dest)).toFile(temp));
      } else {
        await replaceFile(dest, temp => writeFile(temp, JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : ArrayBuffer.isView(v) ? Array.from(v) : v, 2)));
      }
      console.log(dest);
    }
  } catch (error) { failed = true; console.error((file || 'workflow') + ': ' + error.message); }
}
if (failed) process.exitCode = 1;
}
// True when both paths name the same existing file (hard links and symlinks included).
async function sameFile(a, b) {
  try { const [x, y] = await Promise.all([stat(a), stat(b)]); return x.dev === y.dev && x.ino === y.ino; }
  catch { return false; }
}
// Encode in the format the file extension implies, so a name like photo.jpg holds JPEG data.
function encodeAs(image, extension) {
  const format = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.avif': 'avif', '.tif': 'tiff', '.tiff': 'tiff', '.gif': 'gif' }[extension.toLowerCase()];
  if (!format) throw Error('Cannot save an image as ' + (extension || 'a file without an extension') + '; give the filename template one of .png, .jpg, .jpeg, .webp, .avif, .tif, .tiff, .gif');
  return format === 'jpeg' ? image.jpeg({ quality: 92 }) : image[format]();
}
// Write beside the destination, then rename over it, so a failed encode never leaves a damaged or missing original.
async function replaceFile(dest, write) {
  const temp = join(dirname(dest), '.' + basename(dest) + '.' + process.pid + '.tmp');
  try { await write(temp); await rename(temp, dest); }
  finally { await rm(temp, { force: true }); }
}
await main().catch(error => { console.error(error.message); process.exitCode = 1; });
