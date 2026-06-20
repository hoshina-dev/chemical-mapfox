
# UserMembershipResponse


## Properties

Name | Type
------------ | -------------
`createdAt` | string
`organization` | [OrganizationResponse](OrganizationResponse.md)
`organizationId` | string
`role` | [MemberRole](MemberRole.md)

## Example

```typescript
import type { UserMembershipResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "createdAt": 2026-01-01T12:00:00.00000+07:00,
  "organization": null,
  "organizationId": 550e8400-e29b-41d4-a716-446655440001,
  "role": null,
} satisfies UserMembershipResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UserMembershipResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


