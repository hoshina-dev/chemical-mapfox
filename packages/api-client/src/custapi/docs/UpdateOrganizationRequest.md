
# UpdateOrganizationRequest


## Properties

Name | Type
------------ | -------------
`address` | string
`description` | string
`imageUrls` | Array&lt;string&gt;
`lat` | number
`lng` | number
`name` | string

## Example

```typescript
import type { UpdateOrganizationRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "address": 254 St, Bangkok, TH,
  "description": Higher education institution,
  "imageUrls": [https://example.com/example-1.jpg, https://example.com/example-2.jpg],
  "lat": 13.7388,
  "lng": 100.5322,
  "name": Acme Corp,
} satisfies UpdateOrganizationRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateOrganizationRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


