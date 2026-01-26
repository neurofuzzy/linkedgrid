## CI Feedback 🧐

A test triggered by this PR failed. Here is an AI-generated analysis of the failure:

<table><tr><td>

**Action:** Test & Lint (22.x)</td></tr>
<tr><td>

**Failed stage:** [Run linter](https://github.com/neurofuzzy/linkedgrid/actions/runs/21350443412/job/61445782217) [❌]

</td></tr>
<tr><td>

**Failed test name:** ""


</td></tr>
<tr><td>

**Failure summary:**

The GitHub Action failed during <code>npm run lint</code> because ESLint reported 4 errors and exited with code <br>1.<br> The specific blocking errors are in <code>packages/spartan/test/layers.visual.test.ts</code> at:<br> - <code>42:46</code>, <br><code>43:49</code>, <code>44:48</code>, <code>45:49</code>: <code>@typescript-eslint/no-non-null-asserted-optional-chain</code> — non-null assertions <br>used on optional chaining expressions (e.g., <code>foo?.bar!</code>) are disallowed because optional chains can <br>return <code>undefined</code>.<br> Additional lint warnings were present, but the job failed due to these ESLint <br>errors (<code>✖ 21 problems (4 errors, 17 warnings)</code> -> exit code 1).<br>

</td></tr>
<tr><td>

<details><summary>Relevant error logs:</summary>


```yaml
1:  ##[group]Runner Image Provisioner
2:  Hosted Compute Agent
...

137:  5 moderate severity vulnerabilities
138:  To address all issues (including breaking changes), run:
139:  npm audit fix --force
140:  Run `npm audit` for details.
141:  ##[group]Run npm run lint
142:  [36;1mnpm run lint[0m
143:  shell: /usr/bin/bash -e {0}
144:  ##[endgroup]
145:  > linkedgrid@1.0.0 lint
146:  > eslint .
147:  /home/runner/work/linkedgrid/linkedgrid/packages/grid/linked-cell-utils.ts
148:  ##[warning]  3:15  warning  'ILinkedGrid' is defined but never used  @typescript-eslint/no-unused-vars
149:  /home/runner/work/linkedgrid/linkedgrid/packages/grid/test/linked-grid.test.ts
150:  ##[warning]  217:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
151:  /home/runner/work/linkedgrid/linkedgrid/packages/spartan/test/layers.visual.test.ts
152:  ##[error]  42:46  error  Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong  @typescript-eslint/no-non-null-asserted-optional-chain
153:  ##[error]  43:49  error  Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong  @typescript-eslint/no-non-null-asserted-optional-chain
154:  ##[error]  44:48  error  Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong  @typescript-eslint/no-non-null-asserted-optional-chain
155:  ##[error]  45:49  error  Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong  @typescript-eslint/no-non-null-asserted-optional-chain
156:  /home/runner/work/linkedgrid/linkedgrid/packages/spartan/test/visual-helpers.ts
...

161:  ##[warning]  48:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
162:  ##[warning]  49:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
163:  ##[warning]  53:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
164:  ##[warning]  54:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
165:  ##[warning]  77:18  warning  'e' is defined but never used             @typescript-eslint/no-unused-vars
166:  /home/runner/work/linkedgrid/linkedgrid/packages/visual-runner/components/App.tsx
167:  ##[warning]  107:57  warning  'currentSnapshots' is assigned a value but never used  @typescript-eslint/no-unused-vars
168:  ##[warning]  240:43  warning  Unexpected any. Specify a different type               @typescript-eslint/no-explicit-any
169:  ##[warning]  241:47  warning  Unexpected any. Specify a different type               @typescript-eslint/no-explicit-any
170:  /home/runner/work/linkedgrid/linkedgrid/packages/visual-runner/components/InfoPanel.tsx
171:  ##[warning]  5:10  warning  'GameLayers' is defined but never used  @typescript-eslint/no-unused-vars
172:  /home/runner/work/linkedgrid/linkedgrid/packages/visual-runner/lib/test-executor.ts
173:  ##[warning]  180:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
174:  /home/runner/work/linkedgrid/linkedgrid/vite.config.ts
175:  ##[warning]  16:51  warning  'mode' is defined but never used. Allowed unused args must match /^_/u  @typescript-eslint/no-unused-vars
176:  ✖ 21 problems (4 errors, 17 warnings)
177:  ##[error]Process completed with exit code 1.
178:  Post job cleanup.

```
</details></td></tr></table>