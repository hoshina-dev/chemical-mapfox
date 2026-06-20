
# CreateUserRequest


## Properties

Name | Type
------------ | -------------
`avatarUrl` | string
`description` | string
`email` | string
`name` | string
`password` | string
`phoneNumber` | string
`researchCategories` | Array&lt;string&gt;
`socialMedia` | string

## Example

```typescript
import type { CreateUserRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "avatarUrl": https://example.com/avatar.jpg,
  "description": Senior researcher specializing in quantum computing,
  "email": user@example.com,
  "name": John Doe,
  "password": PassWord123!,
  "phoneNumber": +1234567890,
  "researchCategories": [QuantumComputing, Qiskit, Cryogenics],
  "socialMedia": @john on Twitter, linkedin.com/in/john,
} satisfies CreateUserRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateUserRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


