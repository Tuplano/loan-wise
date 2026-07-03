/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ts = require('typescript');

function loadTsModule(relativePath) {
  const absolutePath = path.join(__dirname, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absolutePath,
  });

  const module = { exports: {} };
  const script = new vm.Script(
    `(function (exports, require, module, __filename, __dirname) {${transpiled.outputText}\n})`,
    { filename: absolutePath }
  );
  script.runInThisContext()(module.exports, require, module, absolutePath, path.dirname(absolutePath));
  return module.exports;
}

test('buildLoanSummary separates total cash paid from principal repaid', () => {
  const { buildLoanSummary } = loadTsModule('./loan-summary.ts');

  const summary = buildLoanSummary({
    principalCents: 1_000_000,
    payments: [
      {
        installmentNumber: 1,
        amountCents: 133_333,
        paidCents: 66_667,
        isPaid: false,
      },
    ],
    transactions: [
      {
        amountCents: 66_667,
        principalAppliedCents: 16_667,
      },
    ],
  });

  assert.equal(summary.totalPaidCents, 66_667);
  assert.equal(summary.totalRemainingCents, 66_666);
  assert.equal(summary.principalPaidCents, 16_667);
  assert.equal(summary.remainingPrincipalCents, 983_333);
  assert.equal(summary.principalProgress, 16_667 / 1_000_000);
  assert.equal(summary.currentInstallmentPaidCents, 66_667);
  assert.equal(summary.currentInstallmentRemainingCents, 66_666);
});
