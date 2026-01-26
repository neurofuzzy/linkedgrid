## PR Code Suggestions ✨

<!-- 8dffd4f -->

Explore these optional code suggestions:

<table><thead><tr><td><strong>Category</strong></td><td align=left><strong>Suggestion&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </strong></td><td align=center><strong>Impact</strong></td></tr><tbody><tr><td rowspan=1>High-level</td>
<td>


<details><summary>✅ FIXED: Remove the redundant visual test runner</summary>

___

**Status: RESOLVED**

The `dev/visual-runner.html` file has been removed from the codebase. Only the terminal-based runner in `packages/visual-runner/` remains, aligning with the project's "spartan" principles.


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: The suggestion correctly identified a significant redundancy by introducing two separate visual test runners, which contradicted the project's "spartan" principles and increased maintenance overhead.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>Possible issue</td>
<td>



<details><summary>✅ FIXED: Correctly handle entity rendering layers</summary>

___

**Status: RESOLVED**

The `captureSnapshot` method in `test-executor.ts` has been updated to correctly record layer information for each entity. The implementation at lines 161-194 now includes:

```typescript
entities.push({ id: entityId, type: data.type, x, y, layer });
```

This ensures correct rendering when multiple entities occupy the same cell on different layers.


<details><summary>Suggestion importance[1-10]: 8</summary>

__

Why: This suggestion correctly identified a bug where the visual runner failed to capture entity layers, leading to incorrect grid rendering when multiple entities occupy the same cell.


</details></details></td><td align=center>Medium

</td></tr><tr><td>



<details><summary>✅ FIXED: Capture all assertion failures, not just the first</summary>

___

**Status: RESOLVED**

Modified the `expect` helper in `executeActAssert` to not re-throw errors, allowing all assertions to run. The test result is now determined based on all collected assertions:

```typescript
const expect = (description: string, fn: () => void) => {
  try {
    fn();
    this.assertions.push({ description, passed: true });
  } catch (err) {
    this.assertions.push({
      description,
      passed: false,
      error: (err as Error).message
    });
    // Do not re-throw, to allow all assertions to run
  }
};

// Later...
const testPassed = this.assertions.every(a => a.passed);
return {
  snapshots: this.snapshots,
  passed: testPassed,
  error: testPassed ? undefined : 'One or more assertions failed',
  assertions: this.assertions
};
```


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identified that re-throwing an error in the `expect` helper prevented subsequent assertions from running, leading to incomplete test results. The fix enables comprehensive reporting of all assertion failures.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=1>General</td>
<td>



<details><summary>✅ FIXED: Fix global test index</summary>

___

**Status: RESOLVED**

Replaced the `globalIndex` calculation in `TestSidebar` with a simple counter to generate unique, sequential indices:

```typescript
let counter = 0;
const items = tests.flatMap(testFile => 
  testFile.tests.map(testName => {
    const idx = counter++;
    return {
      key: `${testFile.file}-${testName}-${idx}`,
      label: testName,
      value: { file: testFile.file, testName, globalIndex: idx }
    };
  })
);
```

This prevents potential collisions that could occur with the previous `fileIndex * 1000 + testIndex` approach.


<details><summary>Suggestion importance[1-10]: 7</summary>

__

Why: The suggestion correctly identified a potential bug in the test indexing logic that could cause collisions if a file has more than 1000 tests.


</details></details></td><td align=center>Medium

</td></tr><tr><td rowspan=2>Enhancement</td>
<td>



<details><summary>✅ FIXED: Improve regex for more robust test discovery</summary>

___

**Status: RESOLVED**

Updated `discoverTests` to use a more robust regex that correctly handles escaped quotes and flexible whitespace:

```typescript
// Parse visual() calls - handles escaped quotes and flexible whitespace
const visualRegex = /visual\s*\(\s*(['"])(.*?)(?<!\\)\1\s*,/gs;
const matches = [...content.matchAll(visualRegex)];

return {
  file,
  path: fullPath,
  tests: matches.map(m => m[2])  // Use capture group 2 for the test name
};
```

This ensures all visual tests are discovered reliably, regardless of formatting variations or special characters in test names.


<details><summary>Suggestion importance[1-10]: 5</summary>

__

Why: The suggestion provided a more robust regular expression for test discovery that correctly handles escaped quotes and variable whitespace, preventing tests from being silently skipped.


</details></details></td><td align=center>Low

</td></tr><tr><td>



<details><summary>✅ FIXED: Correctly handle async methods in proxy</summary>

___

**Status: RESOLVED**

Updated the `wrapSpatial` proxy to correctly handle asynchronous methods by checking if a method's result is a Promise:

```typescript
private wrapSpatial(spatial: SpatialSystem): SpatialSystem {
  return new Proxy(spatial, {
    get: (target, prop) => {
      const originalMethod = target[prop as keyof SpatialSystem];
      if (typeof originalMethod !== 'function') return originalMethod;
      
      return (...args: unknown[]) => {
        const result = originalMethod.apply(target, args);
        
        const handleResult = (res: unknown) => {
          if (this.captureEnabled && ['spawn', 'move', 'remove', 'commit'].includes(prop as string)) {
            this.captureSnapshot(target, prop as string, args, res);
          }
          return res;
        };
        
        // Handle async methods
        if (result instanceof Promise) {
          return result.then(handleResult);
        }
        
        return handleResult(result);
      };
    }
  });
}
```

This makes the proxy robust by handling promises correctly and also added `commit` to the list of captured operations.


<details><summary>Suggestion importance[1-10]: 6</summary>

__

Why: The suggestion correctly identified that the proxy didn't handle asynchronous methods, which would lead to incorrect snapshotting if any `SpatialSystem` methods were async. The fix makes the proxy future-proof.


</details></details></td><td align=center>Low

</td></tr><tr><td rowspan=1>Security</td>
<td>



<details><summary>⚠️ NOT APPLICABLE: Use safe DOM APIs for rendering</summary>

___

**Status: N/A**

The HTML-based visual runner (`dev/visual-runner.html`) has been removed from the codebase, so this suggestion no longer applies.


<details><summary>Suggestion importance[1-10]: 3</summary>

__

Why: This suggestion is no longer relevant as the browser-based runner has been removed.


</details></details></td><td align=center>N/A

</td></tr><tr><td rowspan=1>Security</td>
<td>



<details><summary>⚠️ LOW PRIORITY: Prevent path traversal in dynamic import</summary>

___

**Status: NOT FIXED (Low Priority)**

The suggestion to add path validation in `handleSelectTest` before dynamic `import()` has not been implemented. 

**Rationale:** The file paths come from internal scanning via `discoverTests()`, not from external user input. The risk of path traversal is extremely low in this context since:
- Paths are generated by glob pattern matching within the project directory
- The tool is a development-only utility
- There's no external input vector

If this becomes a concern in the future, the following validation could be added:

```typescript
const path = await import('path');
const projectRoot = path.resolve(process.cwd());
const modulePath = path.resolve(projectRoot, file);

if (!modulePath.startsWith(projectRoot)) {
  throw new Error(`Invalid or unsafe test file path: ${file}`);
}
```


<details><summary>Suggestion importance[1-10]: 2</summary>

__

Why: The suggestion addresses a theoretical path traversal vulnerability, but the actual risk is extremely low since file paths are generated internally by scanning the project, not from user input.


</details></details></td><td align=center>Low

</td></tr>
<tr><td align="center" colspan="2">

## Summary

**Fixed:** 6 out of 8 suggestions have been implemented
**Not Applicable:** 1 suggestion (HTML runner removed)
**Deferred:** 1 low-priority security suggestion

All tests passing: ✅ 99/99 tests

</td><td></td></tr></tbody></table>
