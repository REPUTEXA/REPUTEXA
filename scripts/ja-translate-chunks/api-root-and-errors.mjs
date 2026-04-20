import { apiRootPatches } from './api-patches-data.mjs';
import { errorsMainPart1 } from './api-errors-main-part1.mjs';
import { errorsMainPart2 } from './api-errors-main-part2.mjs';
import { billing, ia } from './api-errors-billing-ia.mjs';

const errorsMain = { ...errorsMainPart1, ...errorsMainPart2 };
const out = {};
for (const [k, v] of Object.entries(apiRootPatches)) {
  out[`Api.${k}`] = v;
}
for (const [k, v] of Object.entries(errorsMain)) {
  out[`Api.errors.${k}`] = v;
}
for (const [k, v] of Object.entries(billing)) {
  out[`Api.errors.billing.${k}`] = v;
}
for (const [k, v] of Object.entries(ia)) {
  out[`Api.errors.ia.${k}`] = v;
}
export default out;
