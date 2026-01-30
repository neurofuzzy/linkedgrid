## PR Compliance Guide 🔍


<!-- https://github.com/neurofuzzy/linkedgrid/commit/5af2aee8d1bb3e8667dc2f4b645d65f6be8e9438 -->
Below is a summary of compliance checks for this PR:<br>
<table><tbody><tr><td colspan='2'><strong>Security Compliance</strong></td></tr>
<tr><td>🟢</td><td><details><summary><strong>No security concerns identified</strong></summary>
No security vulnerabilities detected by AI analysis. Human verification advised for critical code.
</details></td></tr>
<tr><td colspan='2'><strong>Ticket Compliance</strong></td></tr>
<tr><td>⚪</td><td><details><summary>🎫 <strong>No ticket provided </strong></summary>


- [ ] Create ticket/issue <!-- /create_ticket --create_ticket=true -->

</details></td></tr>
<tr><td colspan='2'><strong>Codebase Duplication Compliance</strong></td></tr>
<tr><td>⚪</td><td><details><summary><strong>Codebase context is not defined </strong></summary>


Follow the <a href='https://qodo-merge-docs.qodo.ai/core-abilities/rag_context_enrichment/'>guide</a> to enable codebase context checks.

</details></td></tr>
<tr><td colspan='2'><strong>Custom Compliance</strong></td></tr>
<tr><td rowspan=5>🟢</td><td>
<details><summary><strong>Generic: Comprehensive Audit Trails</strong></summary><br>

**Objective:** To create a detailed and reliable record of critical system actions for security analysis <br>and compliance.<br>

**Status:** Passed<br>


> Learn more about managing compliance <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#configuration-options'>generic rules</a> or creating your own <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#custom-compliance'>custom rules</a>
</details></td></tr>
<tr><td>
<details><summary><strong>Generic: Meaningful Naming and Self-Documenting Code</strong></summary><br>

**Objective:** Ensure all identifiers clearly express their purpose and intent, making code <br>self-documenting<br>

**Status:** Passed<br>


> Learn more about managing compliance <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#configuration-options'>generic rules</a> or creating your own <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#custom-compliance'>custom rules</a>
</details></td></tr>
<tr><td>
<details><summary><strong>Generic: Secure Error Handling</strong></summary><br>

**Objective:** To prevent the leakage of sensitive system information through error messages while <br>providing sufficient detail for internal debugging.<br>

**Status:** Passed<br>


> Learn more about managing compliance <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#configuration-options'>generic rules</a> or creating your own <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#custom-compliance'>custom rules</a>
</details></td></tr>
<tr><td>
<details><summary><strong>Generic: Secure Logging Practices</strong></summary><br>

**Objective:** To ensure logs are useful for debugging and auditing without exposing sensitive <br>information like PII, PHI, or cardholder data.<br>

**Status:** Passed<br>


> Learn more about managing compliance <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#configuration-options'>generic rules</a> or creating your own <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#custom-compliance'>custom rules</a>
</details></td></tr>
<tr><td>
<details><summary><strong>Generic: Security-First Input Validation and Data Handling</strong></summary><br>

**Objective:** Ensure all data inputs are validated, sanitized, and handled securely to prevent <br>vulnerabilities<br>

**Status:** Passed<br>


> Learn more about managing compliance <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#configuration-options'>generic rules</a> or creating your own <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#custom-compliance'>custom rules</a>
</details></td></tr>
<tr><td rowspan=1>⚪</td>
<td><details>
<summary><strong>Generic: Robust Error Handling and Edge Case Management</strong></summary><br>

**Objective:** Ensure comprehensive error handling that provides meaningful context and graceful <br>degradation<br>

**Status:** <br><a href='https://github.com/neurofuzzy/linkedgrid/pull/15/files#diff-eb65577d896e76676badd0ca6cf978cf1520f5e854b25bc71c2ce47d63807ad5R165-R233'><strong>Missing bounds checks</strong></a>: The explosion processing uses unvalidated <code>explosionDamage</code>/<code>explosionRadius</code> values (e.g., <br>negative/NaN) and directly applies <code>entityData.hp -= damage</code>, which can cause unintended <br>behavior like healing or invalid field-of-view calculations without explicit guardrails.<br>
<details open><summary>Referred Code</summary>

```typescript
const { x, y, damage, radius } = explosion;

// Get epicenter cell
const epicenter = context.spatial.grid.cell(x, y);
if (!epicenter) return;

// Calculate affected area using fieldOfView with wall blocking
const affectedCells = LinkedCellUtils.fieldOfView(
  epicenter,
  radius,
  (cell) => context.spatial.isBlocked(cell)
);

// Apply effects to all affected cells
for (const cell of affectedCells) {
  // Calculate distance for potential damage falloff (currently using full damage)
  const distance = Math.sqrt((cell.x - x) ** 2 + (cell.y - y) ** 2);
  const effectiveDamage = damage; // Could add falloff: damage * (1 - distance / radius)

  // Apply damage and ignition to all entities at this position
  this.applyExplosionEffects(context, cell.x, cell.y, effectiveDamage);


 ... (clipped 48 lines)
```

</details>

> Learn more about managing compliance <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#configuration-options'>generic rules</a> or creating your own <a href='https://qodo-merge-docs.qodo.ai/tools/compliance/#custom-compliance'>custom rules</a>
</details></td></tr>

<tr><td align="center" colspan="2">

<!-- placeholder --> <!-- /compliance --update_compliance=true -->

</td></tr></tbody></table>
<details><summary>Compliance status legend</summary>
🟢 - Fully Compliant<br>
🟡 - Partial Compliant<br>
🔴 - Not Compliant<br>
⚪ - Requires Further Human Verification<br>
🏷️ - Compliance label<br>
</details>
