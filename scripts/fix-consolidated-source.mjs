import fs from 'node:fs';

const currencyPath = 'blue_modules/currency.ts';
let currency = fs.readFileSync(currencyPath, 'utf8');
currency = currency
  .replace("import * as RNLocalize from 'react-native-localize';\n", '')
  .replace("import { FiatUnit, FiatUnitType, getFiatRate } from '../models/fiatUnit';", "import { FiatUnit, FiatUnitType } from '../models/fiatUnit';")
  .replace(
    'async function setPreferredCurrency(item: FiatUnitType): Promise<void> {\n  item = FiatUnit.GBP;',
    'async function setPreferredCurrency(requestedCurrency: FiatUnitType): Promise<void> {\n  const item = requestedCurrency.endPointKey === FiatUnit.GBP.endPointKey ? requestedCurrency : FiatUnit.GBP;',
  );
fs.writeFileSync(currencyPath, currency);

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
delete pkg.scripts['apply:wiiiwallet-consolidation'];
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Final consolidated source cleanup complete.');
