# Development Rules

1. All examples and tests must support headless automated testing and running in the visual runner
2. After each new gameplay feature, ALWAYS create a new demo game in `dev/games` and add it to `dev/playground.tsx`
3. All tests must use AAA pattern (arrange, act, assert).
4. Whenever being additive, ask _is this spartan?_ Does it have only what is necessary and essential? 
5. Avoid normalizing bad patterns. Each solution should meet high standards regardless of what came before it.
6. Always question the status quo when we encounter ambiguity. Don't be afraid to refactor.
7. All summary documents should go in an `ai-temp` folder.
8. NO emojis.

See also [Developer Context](./DEVELOPER_CONTEXT.md)
See also [Package Contents](./PACKAGE_CONTENTS.md)
See also [Spartan Reviewer Rules](./specs/spartan-review-rules.md)

For a PR to be accepted, it must follow the above rules.
