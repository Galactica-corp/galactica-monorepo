import { expect } from 'chai';

import { parseFieldElement } from '../src/fieldElement';
import { SNARK_SCALAR_FIELD } from '../src/snark';

describe('FieldElement', () => {
  describe('parseFieldElement', () => {
    describe('valid field elements', () => {
      it('should accept valid string decimal numbers', () => {
        const testCases = ['0', '123', '999999', '0', '1'];

        testCases.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.be.a('bigint');
        });
      });

      it('should accept valid string hex numbers', () => {
        const testCases = ['0x0', '0x123', '0xabc', '0X123', '0XABC'];

        testCases.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.be.a('bigint');
        });
      });

      it('should accept valid number values', () => {
        const testCases = [0, 123, 999999, 1];

        testCases.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.be.a('bigint');
        });
      });

      it('should accept boolean values', () => {
        const trueResult = parseFieldElement(true);
        expect(trueResult).to.equal(1n);

        const falseResult = parseFieldElement(false);
        expect(falseResult).to.equal(0n);
      });

      it('should accept valid bigint values', () => {
        const testCases = [0n, 123n, 999999n, 1n];

        testCases.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.equal(value);
        });
      });

      it('should accept values at the boundary of SNARK_SCALAR_FIELD', () => {
        const boundaryValue = SNARK_SCALAR_FIELD - 1n;
        const result = parseFieldElement(boundaryValue);
        expect(result).to.equal(boundaryValue);
      });

      it('should accept string representations of boundary values', () => {
        const boundaryValue = (SNARK_SCALAR_FIELD - 1n).toString();
        const result = parseFieldElement(boundaryValue);
        expect(result).to.equal(SNARK_SCALAR_FIELD - 1n);
      });

      it('should accept whitespace in string values', () => {
        const testCases = [' 123 ', ' 0xabc ', ' 0 '];

        testCases.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.be.a('bigint');
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
          expect(() => parseFieldElement(value as any)).to.throw('Invalid field element type');
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
          expect(() => parseFieldElement(value)).to.throw('String field element is not a valid positive integer');
        });
      });

      it('should reject strings that are too large for the field', () => {
        // These are edge cases that pass validation but are too large for the field
        const tooLargeStrings = [
          `0x${'f'.repeat(1000)}`, // Very large hex number
          '9'.repeat(1000), // Very large decimal number
        ];

        tooLargeStrings.forEach((value) => {
          expect(() => parseFieldElement(value)).to.throw("Field element is not in 'mod SNARK_SCALAR_FIELD'");
        });
      });

      it('should reject negative values', () => {
        const negativeValues = [-1, -123, -1n];

        negativeValues.forEach((value) => {
          expect(() => parseFieldElement(value)).to.throw("Field element is not in 'mod SNARK_SCALAR_FIELD'");
        });
      });

      it('should reject negative string values', () => {
        const negativeValues = ['-1', '-123', '-0x123'];

        negativeValues.forEach((value) => {
          expect(() => parseFieldElement(value)).to.throw('String field element is not a valid positive integer');
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
          expect(() => parseFieldElement(value)).to.throw("Field element is not in 'mod SNARK_SCALAR_FIELD'");
        });
      });

      it('should reject floating point numbers', () => {
        const floatingPointValues = [1.5, 2.7, 0.1, -1.5];

        floatingPointValues.forEach((value) => {
          expect(() => parseFieldElement(value)).to.throw("Field element is not in 'mod SNARK_SCALAR_FIELD'");
        });
      });

      it('should reject NaN and Infinity', () => {
        const specialNumbers = [NaN, Infinity, -Infinity];

        specialNumbers.forEach((value) => {
          expect(() => parseFieldElement(value)).to.throw("Field element is not in 'mod SNARK_SCALAR_FIELD'");
        });
      });
    });

    describe('edge cases', () => {
      it('should handle zero values correctly', () => {
        const zeroValues = [0, 0n, '0', '0x0', false];

        zeroValues.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.equal(0n);
        });
      });

      it('should handle one values correctly', () => {
        const oneValues = [1, 1n, '1', '0x1', true];

        oneValues.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.equal(1n);
        });
      });

      it('should handle large but valid numbers', () => {
        const largeValidNumbers = [
          SNARK_SCALAR_FIELD - 1n,
          (SNARK_SCALAR_FIELD - 1n).toString(),
          `0x${(SNARK_SCALAR_FIELD - 1n).toString(16)}`,
        ];

        largeValidNumbers.forEach((value) => {
          const result = parseFieldElement(value);
          expect(result).to.equal(SNARK_SCALAR_FIELD - 1n);
        });
      });
    });
  });
});
