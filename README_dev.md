# Hints for developers

_Updated on March 22, 2023_

---

## Documentation

Excellent guidance for writing `jsdoc` documentation:

- https://sevic.dev/notes/javascript-jsdoc/
- https://jsdoc.app/howto-es2015-modules.html

Use `jsdoc` at the command line to generate on-line documentation:

```
npx jsdoc src -r --destination docs --readme ./README.md --package ./package.json
```

## Versioning

Use `npm version` at the command line while in your package directory. This must
be done _after_ git committing all code changes.

```
npm version a.b.c
# or
npm version patch
```

## Testing

For ES 6 modules, [uvu](https://www.npmjs.com/package/uvu) is recommended.

Install uvu as a dev dependency:

```
npm install uvu --save-dev
```

The package.json must be modified so that it has:

"scripts": {
"test": "uvu"
},

With Uvu, you can write scripts with the normal ESM import statements.

Using VSCode, you can do interactive testing by loading a file with javascript
commands, setting breakpoints and then starting the debugger. Be sure to select
"Run Current File" before hitting the "Start Debugging" button.
