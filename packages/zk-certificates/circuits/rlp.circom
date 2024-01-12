/* Acknowledgement: Implementation based on https://github.com/yi-sun/zk-attestor */
pragma circom 2.0.2;

include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/multiplexer.circom";

// selects indices [start, end)
template SubArray(nIn, maxSelect, nInBits) {
    signal input in[nIn];
    signal input start;
    signal input end;

    signal output out[maxSelect];
    signal output outLen;

    log(333333300001);
    log(nIn);
    log(maxSelect);
    log(nInBits);
    
    log(start);
    log(end);

    for (var idx = 0; idx < nIn; idx++) {
	log(in[idx]);
    }
    
    component lt1 = LessEqThan(nInBits);
    lt1.in[0] <== start;
    lt1.in[1] <== end;
    lt1.out === 1;

    component lt2 = LessEqThan(nInBits);
    lt2.in[0] <== end;
    lt2.in[1] <== nIn;
    lt2.out === 1;

    component lt3 = LessEqThan(nInBits);
    lt3.in[0] <== end - start;
    lt3.in[1] <== maxSelect;
    lt3.out === 1;

    outLen <== end - start;

    component n2b = Num2Bits(nInBits);
    n2b.in <== start;

    signal shifts[nInBits][nIn];
    for (var idx = 0; idx < nInBits; idx++) {
        for (var j = 0; j < nIn; j++) {
            if (idx == 0) {
	        var tempIdx = (j + (1 << idx)) % nIn;
                shifts[idx][j] <== n2b.out[idx] * (in[tempIdx] - in[j]) + in[j];
            } else {
	        var prevIdx = idx - 1;
	        var tempIdx = (j + (1 << idx)) % nIn;
                shifts[idx][j] <== n2b.out[idx] * (shifts[prevIdx][tempIdx] - shifts[prevIdx][j]) + shifts[prevIdx][j];            
            }
        }
    }

    for (var idx = 0; idx < maxSelect; idx++) {
        out[idx] <== shifts[nInBits - 1][idx];
    }

    log(outLen);
    for (var idx = 0; idx < maxSelect; idx++) {
	log(out[idx]);
    }
}

template ArrayEq(nIn) {
    signal input a[nIn];
    signal input b[nIn];
    signal input inLen;

    signal output out;

    log(333333300002);
    log(nIn);
    log(inLen);

    for (var idx = 0; idx < nIn; idx++) {
	log(a[idx]);
    }
    for (var idx = 0; idx < nIn; idx++) {
	log(b[idx]);
    }    
    
    component leq = LessEqThan(252);
    leq.in[0] <== inLen;
    leq.in[1] <== nIn;
    leq.out === 1;

    component eq[nIn];
    signal matchSum[nIn];

    for (var idx = 0; idx < nIn; idx++) {
        eq[idx] = IsEqual();
        eq[idx].in[0] <== a[idx];
        eq[idx].in[1] <== b[idx];

        if (idx == 0) {
            matchSum[idx] <== eq[idx].out;
        } else {
            matchSum[idx] <== matchSum[idx - 1] + eq[idx].out;
        }
    }

    component matchChooser = Multiplexer(1, nIn + 1);
    matchChooser.inp[0][0] <== 0;
    for (var idx = 0; idx < nIn; idx++) {
        matchChooser.inp[idx + 1][0] <== matchSum[idx];
    }
    matchChooser.sel <== inLen;

    component matchCheck = IsEqual();
    matchCheck.in[0] <== matchChooser.out[0];
    matchCheck.in[1] <== inLen;

    out <== matchCheck.out;

    log(out);
}

template ShiftRight(nIn, nInBits) {
    signal input in[nIn];
    signal input shift;
    signal output out[nIn];

    component n2b = Num2Bits(nInBits);
    n2b.in <== shift;

    signal shifts[nInBits][nIn];
    for (var idx = 0; idx < nInBits; idx++) {
        if (idx == 0) {
            for (var j = 0; j < min((1 << idx), nIn); j++) {
                shifts[0][j] <== - n2b.out[idx] * in[j] + in[j];
            }
            for (var j = (1 << idx); j < nIn; j++) {
                var tempIdx = j - (1 << idx);
                shifts[0][j] <== n2b.out[idx] * (in[tempIdx] - in[j]) + in[j];
            }
        } else {
            for (var j = 0; j < min((1 << idx), nIn); j++) {
                var prevIdx = idx - 1;
                shifts[idx][j] <== - n2b.out[idx] * shifts[prevIdx][j] + shifts[prevIdx][j];
            }
            for (var j = (1 << idx); j < nIn; j++) {
                var prevIdx = idx - 1;
                var tempIdx = j - (1 << idx);
                shifts[idx][j] <== n2b.out[idx] * (shifts[prevIdx][tempIdx] - shifts[prevIdx][j]) + shifts[prevIdx][j];
            }
        }
    }
    for (var i = 0; i < nIn; i++) {
        out[i] <== shifts[nInBits - 1][i];
    }
}

template ShiftLeft(nIn, minShift, maxShift) {
    signal input in[nIn];
    signal input shift;
    signal output out[nIn];

    var shiftBits = log_ceil(maxShift - minShift);

    log(333333300003);
    log(nIn);
    log(minShift);
    log(maxShift);
    log(shift);
    log(shiftBits);
    for (var idx = 0; idx < nIn; idx++) {
        log(in[idx]);
    }

    component n2b = Num2Bits(shiftBits);
    signal shifts[shiftBits][nIn];
    
    if (minShift == maxShift) {
        n2b.in <== 0;
        for (var i = 0; i < nIn; i++) {
	        out[i] <== in[(i + minShift) % nIn];
	    }
    } else {
	    n2b.in <== shift - minShift;

        for (var idx = 0; idx < shiftBits; idx++) {
                if (idx == 0) {
                    for (var j = 0; j < nIn; j++) {
                        var tempIdx = (j + minShift + (1 << idx)) % nIn;
                        var tempIdx2 = (j + minShift) % nIn;
                        shifts[0][j] <== n2b.out[idx] * (in[tempIdx] - in[tempIdx2]) + in[tempIdx2];
                    }
                } else {
                    for (var j = 0; j < nIn; j++) {
                    var prevIdx = idx - 1;
                    var tempIdx = (j + (1 << idx)) % nIn;
                    shifts[idx][j] <== n2b.out[idx] * (shifts[prevIdx][tempIdx] - shifts[prevIdx][j]) + shifts[prevIdx][j];
                    }
                }
        }
        for (var i = 0; i < nIn; i++) {
	        out[i] <== shifts[shiftBits - 1][i];
	    }
    }

    for (var idx = 0; idx < nIn; idx++) {
        log(out[idx]);
    }
}

template RlpArrayPrefix() {
    signal input in[2];
    signal output isBig;
    // get the len of array data
    signal output prefixOrTotalHexLen;	
    signal output isValid;

    log(333333300004);
    log(in[0]);
    log(in[1]);

    component n2b1 = Num2Bits(4);
    component n2b2 = Num2Bits(4);
    n2b1.in <== in[0];
    n2b2.in <== in[1];

    // if starts with < 'c', then invalid
    component lt1 = LessThan(4);
    lt1.in[0] <== in[0];
    lt1.in[1] <== 12;

    // if starts with == 'f'
    component eq = IsEqual();
    eq.in[0] <== in[0];
    eq.in[1] <== 15;

    component lt2 = LessThan(4);
    lt2.in[0] <== in[1];
    lt2.in[1] <== 8;

    isBig <== eq.out * (1 - lt2.out);
    
    // [c0, f7] or [f8, ff]
    var prefixVal = 16 * in[0] + in[1];
    isValid <== 1 - lt1.out;
    signal lenTemp;

    // 2 * (prefixVal - 0xc0 ) + 2 * isBig * (0xc0 - 0xf7)
    // 0 -55 bytes long RLP encoding consists of a single byte with value 0xc0 plus the length of the list. 
    // > 55 bytes, The first one is a single byte with value 0xf7 plus the length in bytes of the second part

    lenTemp <== 2 * (prefixVal - 16 * 12) + 2 * isBig * (16 * 12 - 16 * 15 - 7);
    prefixOrTotalHexLen <== isValid * lenTemp;

    log(isBig);
    log(prefixOrTotalHexLen);
    log(isValid);
}

template RlpFieldPrefix() {
    signal input in[2];
    signal output isBig;
    signal output isLiteral;
    signal output prefixOrTotalHexLen;
    signal output isValid;
    signal output isEmptyList;

    log(333333300005);
    log(in[0]);
    log(in[1]);

    component n2b1 = Num2Bits(4);
    component n2b2 = Num2Bits(4);
    n2b1.in <== in[0];
    n2b2.in <== in[1];

    // if starts with >= 'c', then invalid
    component lt1 = LessThan(4);
    lt1.in[0] <== in[0];
    lt1.in[1] <== 12;

    // if starts with < '8', then literal
    component lt2 = LessThan(4);
    lt2.in[0] <== in[0];
    lt2.in[1] <== 8;

    // if starts with 'b' and >= 8, then has length bytes
    component eq = IsEqual();
    eq.in[0] <== in[0];
    eq.in[1] <== 11;

    component lt3 = LessThan(4);
    lt3.in[0] <== in[1];
    lt3.in[1] <== 8;

    // if is 'c0', then is an empty list
    component eq1 = IsEqual();
    eq1.in[0] <== in[0];
    eq1.in[1] <== 12;

    component eq2 = IsEqual();
    eq2.in[0] <== in[1];
    eq2.in[1] <== 0;

    isLiteral <== lt2.out;
    isBig <== eq.out * (1 - lt3.out);
    isEmptyList <== eq1.out * eq2.out;
    
    var prefixVal = 16 * in[0] + in[1];
    // [00, 7f] or [80, b7] or [b8, bf]
    signal lenTemp;
    signal lenTemp2;
    lenTemp <== 2 * (prefixVal - 16 * 8) + 2 * isBig * (16 * 8 - 16 * 11 - 7);
    lenTemp2 <== (1 - isLiteral) * lenTemp;
    prefixOrTotalHexLen <== (1 - isEmptyList) * lenTemp2;

    isValid <== lt1.out + isEmptyList - lt1.out * isEmptyList;

    log(isBig);
    log(isLiteral);
    log(prefixOrTotalHexLen);
    log(isValid);
    log(isEmptyList);
}

// fieldMinHexLens, fieldMaxHexLens are arrays of length nFields
// check RLP array validity, encoded data looks like (RLP(Array[RLP(Filed), RLP(Field)]))
template RlpArrayCheck(maxHexLen, nFields, arrayPrefixMaxHexLen, fieldMinHexLen, fieldMaxHexLen) {
    signal input in[maxHexLen];

    signal output out;
    signal output fieldHexLen[nFields];	
    signal output fields[nFields][maxHexLen];
    signal output totalRlpHexLen;

    log(333333300006);
    log(maxHexLen);
    log(nFields);
    log(arrayPrefixMaxHexLen);
    for (var idx = 0; idx < nFields; idx++) {
        log(fieldMinHexLen[idx]);
    }
    for (var idx = 0; idx < nFields; idx++) {
        log(fieldMaxHexLen[idx]);
    }
    for (var idx = 0; idx < maxHexLen; idx++) {
        log(in[idx]);
    }

    component rlpArrayPrefix = RlpArrayPrefix();
    rlpArrayPrefix.in[0] <== in[0];
    rlpArrayPrefix.in[1] <== in[1];

    // when >55 bytes, the prefix len
    signal arrayRlpPrefix1HexLen;
    arrayRlpPrefix1HexLen <== rlpArrayPrefix.isBig * rlpArrayPrefix.prefixOrTotalHexLen;

    // the Multiplerxer for len > 55 bytes scenario, the prefix include 3 parts, The second part is the length of total payload, 
    // the inputs is: 
    // a_0_0
    // a_1_0
    // ...
    // a_arrayPrefixMaxHexLen_0
    // selector second part of prefix hex from inputs
    component totalArray = Multiplexer(1, arrayPrefixMaxHexLen);
    var temp = 0;
    for (var idx = 0; idx < arrayPrefixMaxHexLen; idx++) {
        // for big(>55), first 2 hex is parts 0 (0xf7 + part2 length), we just care about part2 here.
        temp = 16 * temp + in[2 + idx];
	    totalArray.inp[idx][0] <== temp;
    }
    totalArray.sel <== rlpArrayPrefix.isBig * (arrayRlpPrefix1HexLen - 1);

    // definition as actual data hex len, if this isBig. the second part data = totalArray.out[0] represent the playload len. 
    signal totalArrayHexLen;
    totalArrayHexLen <== rlpArrayPrefix.prefixOrTotalHexLen + rlpArrayPrefix.isBig * (2 * totalArray.out[0] - rlpArrayPrefix.prefixOrTotalHexLen);
    
    totalRlpHexLen <== 2 + arrayRlpPrefix1HexLen + totalArrayHexLen;

    component shiftToFieldRlps[nFields];
    component shiftToField[nFields];
    component fieldPrefix[nFields];

    signal fieldRlpPrefix1HexLen[nFields];
    component fieldHexLenMulti[nFields];
    signal field_temp[nFields];
    
    // start to decode the all fields in array
    for (var idx = 0; idx < nFields; idx++) {
        var lenPrefixMaxHexs = 2 * (log_ceil(fieldMaxHexLen[idx]) \ 8 + 1);
        if (idx == 0) {
            shiftToFieldRlps[idx] = ShiftLeft(maxHexLen, 0, 2 + arrayPrefixMaxHexLen);
	    } else {
            shiftToFieldRlps[idx] = ShiftLeft(maxHexLen, fieldMinHexLen[idx - 1], fieldMaxHexLen[idx - 1]);
	    }
        shiftToField[idx] = ShiftLeft(maxHexLen, 0, lenPrefixMaxHexs);
        fieldPrefix[idx] = RlpFieldPrefix();
	
        if (idx == 0) {	
            for (var j = 0; j < maxHexLen; j++) {
                shiftToFieldRlps[idx].in[j] <== in[j];
            }
            shiftToFieldRlps[idx].shift <== 2 + arrayRlpPrefix1HexLen;
	    } else {
	        for (var j = 0; j < maxHexLen; j++) {
                // left move to last field hex length
                shiftToFieldRlps[idx].in[j] <== shiftToField[idx - 1].out[j];
            }
	        shiftToFieldRlps[idx].shift <== fieldHexLen[idx - 1];
	    }
	
        fieldPrefix[idx].in[0] <== shiftToFieldRlps[idx].out[0];
        fieldPrefix[idx].in[1] <== shiftToFieldRlps[idx].out[1];

        fieldRlpPrefix1HexLen[idx] <== fieldPrefix[idx].isBig * fieldPrefix[idx].prefixOrTotalHexLen;

        fieldHexLenMulti[idx] = Multiplexer(1, lenPrefixMaxHexs);
        var temp = 0;
        for (var j = 0; j < lenPrefixMaxHexs; j++) {
            temp = 16 * temp + shiftToFieldRlps[idx].out[2 + j];
            fieldHexLenMulti[idx].inp[j][0] <== temp;
        }
        fieldHexLenMulti[idx].sel <== fieldPrefix[idx].isBig * (fieldRlpPrefix1HexLen[idx] - 1);

        // get the actual prefix length, fieldHexLen can met all case of variable-length for literal or < 55byte or > 55bytes
        var temp2 = (2 * fieldHexLenMulti[idx].out[0] - fieldPrefix[idx].prefixOrTotalHexLen);
        field_temp[idx] <== fieldPrefix[idx].prefixOrTotalHexLen + fieldPrefix[idx].isBig * temp2;
        fieldHexLen[idx] <== field_temp[idx] + 2 * fieldPrefix[idx].isLiteral - field_temp[idx] * fieldPrefix[idx].isLiteral;

        for (var j = 0; j < maxHexLen; j++) {
            shiftToField[idx].in[j] <== shiftToFieldRlps[idx].out[j];
        }
        shiftToField[idx].shift <== 2 + fieldRlpPrefix1HexLen[idx] - fieldPrefix[idx].isLiteral * (2 + fieldRlpPrefix1HexLen[idx]);

        for (var j = 0; j < maxHexLen; j++) {
            fields[idx][j] <== shiftToField[idx].out[j];
        }
    }

    var check = rlpArrayPrefix.isValid;
    for (var idx = 0; idx < nFields; idx++) {
    	check = check + fieldPrefix[idx].isValid;
    }

    var lenSum = 0;
    for (var idx = 0; idx < nFields; idx++) {
        lenSum = lenSum + 2 - 2 * fieldPrefix[idx].isLiteral + fieldRlpPrefix1HexLen[idx] + fieldHexLen[idx];
    }
    component lenCheck = IsEqual();
    lenCheck.in[0] <== totalArrayHexLen;
    lenCheck.in[1] <== lenSum;

    component outCheck = IsEqual();
    outCheck.in[0] <== check + lenCheck.out;
    outCheck.in[1] <== nFields + 2;
    
    out <== outCheck.out;

    log(out);
    log(totalRlpHexLen);
    for (var idx = 0; idx < nFields; idx++) {
        log(fieldHexLen[idx]);
    }
    for (var idx = 0; idx < nFields; idx++) {
        for (var j = 0; j < maxHexLen; j++) {
            log(fields[idx][j]);
	    }
    }
}
