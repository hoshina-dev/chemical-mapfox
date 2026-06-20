
# UserDetailResponse


## Properties

Name | Type
------------ | -------------
`avatarUrl` | string
`createdAt` | string
`description` | string
`email` | string
`id` | string
`name` | string
`password` | string
`phoneNumber` | string
`researchCategories` | Array&lt;string&gt;
`role` | [UserRole](UserRole.md)
`socialMedia` | string
`updatedAt` | string

## Example

```typescript
import type { UserDetailResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "avatarUrl": https://example.com/avatar.jpg,
  "createdAt": 2026-01-01T12:00:00.00000+07:00,
  "description": Senior researcher specializing in quantum computing,
  "email": user@example.com,
  "id": 550e8400-e29b-41d4-a716-446655440000,
  "name": John Doe,
  "password": $2a$10$hashedpassword,
  "phoneNumber": +1234567890,
  "researchCategories": [QuantumComputing, Qiskit, Cryogenics],
  "role": null,
  "socialMedia": @john on Twitter, linkedin.com/in/john,
  "updatedAt": 2026-01-01T12:00:00.00000+07:00,
} satisfies UserDetailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UserDetailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


