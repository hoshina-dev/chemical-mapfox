
# OrganizationResponse


## Properties

Name | Type
------------ | -------------
`address` | string
`createdAt` | string
`description` | string
`id` | string
`imageUrls` | Array&lt;string&gt;
`lat` | number
`lng` | number
`name` | string
`updatedAt` | string

## Example

```typescript
import type { OrganizationResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "address": 254 St, Bangkok, TH,
  "createdAt": 2026-01-01T12:00:00.00000+07:00,
  "description": Higher education institution,
  "id": 550e8400-e29b-41d4-a716-446655440001,
  "imageUrls": [https://example.com/example-1.jpg, https://example.com/example-2.jpg],
  "lat": 13.7888,
  "lng": 100.5322,
  "name": Acme Corp,
  "updatedAt": 2026-01-01T12:00:00.00000+07:00,
} satisfies OrganizationResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OrganizationResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


