
# OrganizationCoord


## Properties

Name | Type
------------ | -------------
`id` | string
`lat` | number
`lng` | number

## Example

```typescript
import type { OrganizationCoord } from ''

// TODO: Update the object below with actual values
const example = {
  "id": 550e8400-e29b-41d4-a716-446655440001,
  "lat": 13.7388,
  "lng": 100.5322,
} satisfies OrganizationCoord

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OrganizationCoord
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


