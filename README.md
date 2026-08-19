# srvem [![JSR](https://jsr.io/badges/@izz/srvem)](https://jsr.io/@izz/srvem)

Yet another module to query valve-style game servers.

## Example

```ts
import { query } from "@izz/srvem";

const server = await query(example.com);
console.log(server.name);
```
