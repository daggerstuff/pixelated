## 2024-05-21 - Conditional ARIA References
**Learning:** `aria-describedby` pointing to non-existent IDs (due to conditional rendering) is a common accessibility bug found in `PasswordInputWithStrength`.
**Action:** Always verify that referenced IDs exist in the DOM when constructing ARIA attributes, or conditionally build the attribute value.
