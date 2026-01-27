# Spartan Code Review: Essentialism Checklist

## Core Question
For every element (function, variable, abstraction, dependency, line):
**"What breaks if this is removed?"** 
- If the answer is "nothing" → flag for removal
- If the answer is "readability suffers slightly" → probably remove it
- If the answer is "core functionality breaks" → keep it

## Review Criteria

1. **Identify non-essential elements**
   - Redundant logic or duplicate code paths
   - Abstractions that don't reduce complexity
   - Variables used only once
   - Helper functions that obscure more than they clarify
   - Dependencies that aren't earning their weight

2. **Assess distance from the essential form**
   - How many steps away is this code from its minimal working form?
   - What's the simplest implementation that would still work?
   - Rate the "essence score" (1-10, where 10 is perfectly distilled)

3. **Flag anti-spartan patterns**
   - Premature abstraction or over-engineering
   - Boilerplate that could be eliminated
   - Comments explaining what the code should already show
   - Defensive programming that adds ceremony without value

4. **Challenge the status quo**
   - Does this match existing patterns because they're good, or just because they exist?
   - Would starting from scratch yield something simpler?
   - Is convention being preserved at the cost of clarity?

## The Standard
Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.