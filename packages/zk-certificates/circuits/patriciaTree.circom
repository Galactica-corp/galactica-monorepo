/* Acknowledgement: Implementation based on https://github.com/yi-sun/zk-attestor */
pragma circom 2.0.2;

include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/gates.circom";
include "../../../node_modules/circomlib/circuits/multiplexer.circom";

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "./rlp.circom";
include "./patriciaTree_utils.circom";

// Proves inclusion of (key, value) in a MPT
// Assumes all keys have a fixed bit length, so that branches have length 16 only
// and all paths terminate in a leaf
// For learning about Merkle Patricia Tries check out https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie#merkle-patricia-trees
// This version was simplified to use the Poseidon Hash instead of Keccak and the leaf is assumed to be a single field element (hash or score)
// keyHexLen: 64 
template MPTInclusionFixedKeyHexLen(maxDepth, keyHexLen, maxValueHexLen) {
    var maxLeafRlpHexLen = 4 + (keyHexLen + 2) + 4 + maxValueHexLen;
    var maxBranchRlpHexLen = 1064;
    var maxExtensionRlpHexLen = 4 + 2 + keyHexLen + 2 + 64;

    var KEY_BITS = log_ceil(keyHexLen); // log_ceil(64) = 6
    
    signal input keyHexs[keyHexLen];
    signal input valueHexs[maxValueHexLen];
    signal input rootHash;

    signal input keyFragmentStarts[maxDepth];
    
    // leaf = rlp_prefix           [2]
    //        rlp_length           [0, 2 * ceil(log_8(1 + ceil(log_8(4 * keyHexLen + 4)) + 4 + keyHexLen + 2 +  2 * ceil(log_8(maxValueHexLen)) + maxValueHexLen))]
    //        path_rlp_prefix      [2]
    //        path_rlp_length      [0, 2 * ceil(log_8(keyHexLen + 2))]
    //        path_prefix          [0, 1, 2]                                // 0 if path is literal
    //        path                 [0, keyHexLen]
    //        value_rlp_prefix     [2]
    //        value_rlp_length     [0, 2 * ceil(log_8(maxValueHexLen))]
    //        value                [0, maxValueHexLen]
    signal input leafRlpHexs[maxLeafRlpHexLen];

    signal input leafPathPrefixHexLen;
    
    // extension = rlp_prefix           [2]
    //             rlp_length           [0, 2 * ceil((...))]
    //             path_rlp_prefix      [2]
    //             path_rlp_length      [0, 2 * ceil(log_8(4 * keyHexLen + 4))]
    //             path_prefix          [0, 1, 2]                             // 0 if path is literal
    //             path                 [0, keyHexLen]
    //             nodeRef_rlp_prefix   [2]
    //             node_ref             [0, 64]
    // branch = rlp_prefix              [2]
    //          rlp_length              [0, 6]
    //          v0_rlp_prefix           [2]
    //          v0                      [0, 64]
    //          ...
    //          v15_rlp_prefix          [2]
    //          v15                     [0, 64]
    //          vt_rlp_prefix           [2]
    signal input nodeRlpHexs[maxDepth - 1][maxBranchRlpHexLen];

    signal input nodePathPrefixHexLen[maxDepth - 1];
    
    // index 0 = root; value 0 = branch, 1 = extension
    signal input nodeTypes[maxDepth - 1];
    signal input depth;
    
    signal output out;
    signal output valueHexLen;

    log(111111100007);
    log(maxDepth);
    log(keyHexLen);
    log(maxValueHexLen);

    // check depth is valid
    component depthCheck = LessEqThan(10);
    depthCheck.in[0] <== depth;
    depthCheck.in[1] <== maxDepth;
    depthCheck.out === 1;

    // check nodeTypes are valid, so either 0 (= branch) or 1 (= extension)
    component nodeTypesValid[maxDepth - 1];
    for (var idx = 0; idx < maxDepth - 1; idx++) {
    	nodeTypesValid[idx] = Num2Bits(1);
	    nodeTypesValid[idx].in <== nodeTypes[idx];
    }

    // check keyFragmentStarts are monotone, consistent with nodeTypes, and in range
    component keyFragmentValidBranch[maxDepth - 1];
    component isSingleKeyFragment[maxDepth - 1];
    component isMonotoneStart[maxDepth - 1];
    component isStartRange[maxDepth];
    for (var idx = 0; idx < maxDepth - 1; idx++) {
    	isSingleKeyFragment[idx] = IsEqual();
        isSingleKeyFragment[idx].in[0] <== keyFragmentStarts[idx + 1] - keyFragmentStarts[idx];
        isSingleKeyFragment[idx].in[1] <== 1;

        isMonotoneStart[idx] = LessThan(KEY_BITS);
        isMonotoneStart[idx].in[0] <== keyFragmentStarts[idx];
        isMonotoneStart[idx].in[1] <== keyFragmentStarts[idx + 1];

        keyFragmentValidBranch[idx] = OR();
        keyFragmentValidBranch[idx].a <== isSingleKeyFragment[idx].out;
        keyFragmentValidBranch[idx].b <== 1 - nodeTypes[idx];

        isStartRange[idx] = LessThan(KEY_BITS);
        isStartRange[idx].in[0] <== keyFragmentStarts[idx];
        isStartRange[idx].in[1] <== keyHexLen;
    }
    isStartRange[maxDepth - 1] = LessThan(KEY_BITS);    
    isStartRange[maxDepth - 1].in[0] <== keyFragmentStarts[maxDepth - 1];
    isStartRange[maxDepth - 1].in[1] <== keyHexLen;
    component allFragmentsValid_multi = Multiplexer(1, maxDepth);
    var temp = 0;
    for (var idx = 0; idx < maxDepth - 1; idx++) {
        temp = temp + keyFragmentValidBranch[idx].out + isMonotoneStart[idx].out + isStartRange[idx].out;
        allFragmentsValid_multi.inp[idx][0] <== temp;
    }
    allFragmentsValid_multi.inp[maxDepth - 1][0] <== temp + isStartRange[maxDepth - 1].out + 2;
    allFragmentsValid_multi.sel <== depth - 1;

    component allFragmentsValid = IsEqual();
    allFragmentsValid.in[0] <== allFragmentsValid_multi.out[0];
    allFragmentsValid.in[1] <== 3 * depth;

    // constrain Leaf
    component leafStartSelector = Multiplexer(1, maxDepth);
    for (var idx = 0; idx < maxDepth; idx++) {
	    leafStartSelector.inp[idx][0] <== keyFragmentStarts[idx];
    }
    leafStartSelector.sel <== depth - 1;
	
    component leafSelector = SubArray(keyHexLen, keyHexLen, KEY_BITS);
    for (var idx = 0; idx < keyHexLen; idx++) {
	    leafSelector.in[idx] <== keyHexs[idx];
    }
    leafSelector.start <== leafStartSelector.out[0];
    leafSelector.end <== keyHexLen;

    component leaf = LeafCheck(keyHexLen, maxValueHexLen);    
    leaf.keyNibbleHexLen <== leafSelector.outLen;
    for (var idx = 0; idx < keyHexLen; idx++) {
	    leaf.keyNibbleHexs[idx] <== leafSelector.out[idx];
    }
    for (var idx = 0; idx < maxValueHexLen; idx++) {
	leaf.valueHexs[idx] <== valueHexs[idx];
    }
    for (var idx = 0; idx < maxLeafRlpHexLen; idx++) {
	    leaf.leafRlpHexs[idx] <== leafRlpHexs[idx];
    } 
    leaf.leafPathPrefixHexLen <== leafPathPrefixHexLen;

    // hash of leaf
    component leafHash = Poseidon(maxLeafRlpHexLen);
    for (var idx = 0; idx < maxLeafRlpHexLen; idx++) {
	    leafHash.inputs[idx] <== leafRlpHexs[idx];
    }

    // masks for depth selector
    component depthEq[maxDepth];
    component depthLt[maxDepth];
    for (var layer = 0; layer < maxDepth; layer++) {
        depthEq[layer] = IsEqual();
        depthEq[layer].in[0] <== depth;
        depthEq[layer].in[1] <== layer + 1;

        depthLt[layer] = LessThan(10);
        depthLt[layer].in[0] <== layer;
        depthLt[layer].in[1] <== depth;
    }

    // constrain nodes along path along with their hashes
    var maxNodeRlpHexLen = 1064;

    component extKeySelectors[maxDepth - 1];
    component exts[maxDepth - 1];
    
    component nibbleSelector[maxDepth - 1];
    component branches[maxDepth - 1];

    component nodeHashes[maxDepth - 1];

    for (var layer = maxDepth - 2; layer >= 0; layer--) {
        // constrain Extension
        extKeySelectors[layer] = SubArray(keyHexLen, keyHexLen, KEY_BITS);
        for (var idx = 0; idx < keyHexLen; idx++) {
            extKeySelectors[layer].in[idx] <== keyHexs[idx];
        }
        extKeySelectors[layer].start <== keyFragmentStarts[layer];
        extKeySelectors[layer].end <== keyFragmentStarts[layer + 1];
        
        exts[layer] = ExtensionCheck(keyHexLen);
        exts[layer].keyNibbleHexLen <== keyFragmentStarts[layer + 1] - keyFragmentStarts[layer];
        for (var idx = 0; idx < keyHexLen; idx++) {
            exts[layer].keyNibbleHexs[idx] <== extKeySelectors[layer].out[idx];
        }

        // if layer + 1 > depth, we do not care what values are filled in
        if (layer == maxDepth - 2) {
            exts[layer].nodeRefHash <== depthEq[layer + 1].out * leafHash.out[idx];
        } else {
            exts[layer].nodeRefHash <== depthEq[layer + 1].out * (leafHash.out - nodeHashes[layer + 1].out) + nodeHashes[layer + 1].out;
        }

        exts[layer].nodePathPrefixHexLen <== nodePathPrefixHexLen[layer];
        for (var idx = 0; idx < maxExtensionRlpHexLen; idx++) {
            exts[layer].nodeRlpHexs[idx] <== nodeTypes[layer] * nodeRlpHexs[layer][idx];
        }

        // constrain Branch
        nibbleSelector[layer] = Multiplexer(1, keyHexLen);
        for (var idx = 0; idx < keyHexLen; idx++) {
            nibbleSelector[layer].inp[idx][0] <== keyHexs[idx];
        }
        nibbleSelector[layer].sel <== depthLt[layer].out * keyFragmentStarts[layer];
        
        branches[layer] = EmptyVtBranchCheck();	
        branches[layer].keyNibble <== nibbleSelector[layer].out[0];

        // if layer + 1 > depth, we do not care what values are filled in
        if (layer == maxDepth - 2) {
            branches[layer].nodeRefHash <== depthEq[layer + 1].out * leafHash.out;
        } else {
            branches[layer].nodeRefHash <== depthEq[layer + 1].out * (leafHash.out - nodeHashes[layer + 1].out) + nodeHashes[layer + 1].out;
        }
        
        for (var idx = 0; idx < maxBranchRlpHexLen; idx++) {
            branches[layer].nodeRlpHexs[idx] <== (1 - nodeTypes[layer]) * nodeRlpHexs[layer][idx];
        }

        // compute hashes at each layer
        nodeHashes[layer] = Poseidon(maxNodeRlpHexLen);
        for (var idx = 0; idx < maxNodeRlpHexLen; idx++) {
            nodeHashes[layer].inputs[idx] <== nodeRlpHexs[layer][idx];
        }
    }

    // check rootHash
    component rootHashCheck = IsEqual();
    rootHashCheck.in[0] <== rootHash;
    rootHashCheck.in[0] <== nodeHashes[0].out;
    
    component checksPassed = Multiplexer(1, maxDepth);
    checksPassed.inp[0][0] <== rootHashCheck.out + leaf.out + allFragmentsValid.out;
    for (var layer = 0; layer < maxDepth - 1; layer++) {
	    checksPassed.inp[layer + 1][0] <== checksPassed.inp[layer][0] + branches[layer].out + nodeTypes[layer] * (exts[layer].out - branches[layer].out);
    }
    checksPassed.sel <== depth - 1;

    component numChecks = IsEqual();
    numChecks.in[0] <== checksPassed.out[0];
    numChecks.in[1] <== 4 * depth + 2;
    out <== numChecks.out;
    valueHexLen <== leaf.valueHexLen;

    log(out);
    log(valueHexLen);
    for (var idx = 0; idx < maxDepth; idx++) {
	    log(checksPassed.inp[idx][0]);
    }
}
