import { expect } from 'chai';

import { isValidFieldElement } from '../src/fieldElement';
import { SNARK_SCALAR_FIELD } from '../src/snark';

describe('FieldElement', () => {
  describe('isValidFieldElement', () => {
    describe('valid field elements', () => {
      it('should accept valid string decimal numbers', () => {
        const testCases = ['0', '123', '999999', '0', '1'];

        testCases.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });

      it('should accept valid string hex numbers', () => {
        const testCases = ['0x0', '0x123', '0xabc', '0X123', '0XABC'];

        testCases.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });

      it('should accept valid number values', () => {
        const testCases = [0, 123, 999999, 1];

        testCases.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });

      it('should accept boolean values', () => {
        const trueResult = isValidFieldElement(true);
        expect(trueResult.valid).to.be.true;
        expect(trueResult.error).to.be.undefined;

        const falseResult = isValidFieldElement(false);
        expect(falseResult.valid).to.be.true;
        expect(falseResult.error).to.be.undefined;
      });

      it('should accept valid bigint values', () => {
        const testCases = [0n, 123n, 999999n, 1n];

        testCases.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });

      it('should accept values at the boundary of SNARK_SCALAR_FIELD', () => {
        const boundaryValue = SNARK_SCALAR_FIELD - 1n;
        const result = isValidFieldElement(boundaryValue);
        expect(result.valid).to.be.true;
        expect(result.error).to.be.undefined;
      });

      it('should accept string representations of boundary values', () => {
        const boundaryValue = (SNARK_SCALAR_FIELD - 1n).toString();
        const result = isValidFieldElement(boundaryValue);
        expect(result.valid).to.be.true;
        expect(result.error).to.be.undefined;
      });

      it('should accept whitespace in string values', () => {
        const testCases = [' 123 ', ' 0xabc ', ' 0 '];

        testCases.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });
    });

    describe('invalid field elements', () => {
      it('should reject invalid types', () => {
        const invalidTypes = [
          null,
          undefined,
          {},
          [],
          expect, // just some function
          Symbol('test'),
        ];

        invalidTypes.forEach((value) => {
          const result = isValidFieldElement(value as any);
          expect(result.valid).to.be.false;
          expect(result.error).to.include('Invalid field element type');
        });
      });

      it('should reject invalid string formats', () => {
        const invalidStrings = [
          'abc',
          '12.34',
          '0x',
          '0xg',
          '123abc',
          'abc123',
          '0x123g',
          '1.23',
          '1e5',
          '1.23e5',
        ];

        invalidStrings.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            'String field element is not a valid positive integer',
          );
        });
      });

      it('should reject strings that cannot be converted to BigInt', () => {
        // These are edge cases that might cause BigInt conversion to fail
        const invalidBigIntStrings = [
          `0x${'f'.repeat(1000)}`, // Very large hex number
          '9'.repeat(1000), // Very large decimal number
        ];

        invalidBigIntStrings.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            "Field element is not in 'mod SNARK_SCALAR_FIELD'",
          );
        });
      });

      it('should reject negative values', () => {
        const negativeValues = [-1, -123, -1n];

        negativeValues.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            "Field element is not in 'mod SNARK_SCALAR_FIELD'",
          );
        });
      });

      it('should reject negative string values', () => {
        const negativeValues = ['-1', '-123', '-0x123'];

        negativeValues.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            'String field element is not a valid positive integer',
          );
        });
      });

      it('should reject values equal to or greater than SNARK_SCALAR_FIELD', () => {
        const tooLargeValues = [
          SNARK_SCALAR_FIELD,
          SNARK_SCALAR_FIELD + 1n,
          SNARK_SCALAR_FIELD * 2n,
          SNARK_SCALAR_FIELD.toString(),
          (SNARK_SCALAR_FIELD + 1n).toString(),
        ];

        tooLargeValues.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            "Field element is not in 'mod SNARK_SCALAR_FIELD'",
          );
        });
      });

      it('should reject floating point numbers', () => {
        const floatingPointValues = [1.5, 2.7, 0.1, -1.5];

        floatingPointValues.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            "Field element is not in 'mod SNARK_SCALAR_FIELD'",
          );
        });
      });

      it('should reject NaN and Infinity', () => {
        const specialNumbers = [NaN, Infinity, -Infinity];

        specialNumbers.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.false;
          expect(result.error).to.include(
            "Field element is not in 'mod SNARK_SCALAR_FIELD'",
          );
        });
      });
    });

    describe('edge cases', () => {
      it('should handle zero values correctly', () => {
        const zeroValues = [0, 0n, '0', '0x0', false];

        zeroValues.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });

      it('should handle one values correctly', () => {
        const oneValues = [1, 1n, '1', '0x1', true];

        oneValues.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });

      it('should handle large but valid numbers', () => {
        const largeValidNumbers = [
          SNARK_SCALAR_FIELD - 1n,
          (SNARK_SCALAR_FIELD - 1n).toString(),
          `0x${(SNARK_SCALAR_FIELD - 1n).toString(16)}`,
        ];

        largeValidNumbers.forEach((value) => {
          const result = isValidFieldElement(value);
          expect(result.valid).to.be.true;
          expect(result.error).to.be.undefined;
        });
      });
    });
  });
});
