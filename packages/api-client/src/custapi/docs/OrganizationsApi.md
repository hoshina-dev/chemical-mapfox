# OrganizationsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**organizationsBatchPost**](OrganizationsApi.md#organizationsbatchpost) | **POST** /organizations/batch | Get organizations by multiple IDs (batch) |
| [**organizationsCoordinatesGet**](OrganizationsApi.md#organizationscoordinatesget) | **GET** /organizations/coordinates | Get all organization coordinates |
| [**organizationsGet**](OrganizationsApi.md#organizationsget) | **GET** /organizations | Get all organizations |
| [**organizationsIdDelete**](OrganizationsApi.md#organizationsiddelete) | **DELETE** /organizations/{id} | Delete an organization |
| [**organizationsIdGet**](OrganizationsApi.md#organizationsidget) | **GET** /organizations/{id} | Get an organization by ID |
| [**organizationsIdMembersGet**](OrganizationsApi.md#organizationsidmembersget) | **GET** /organizations/{id}/members | Get members of an organization |
| [**organizationsIdMembersPost**](OrganizationsApi.md#organizationsidmemberspost) | **POST** /organizations/{id}/members | Add a member to an organization |
| [**organizationsIdMembersUserIdDelete**](OrganizationsApi.md#organizationsidmembersuseriddelete) | **DELETE** /organizations/{id}/members/{user_id} | Remove a member from an organization |
| [**organizationsIdMembersUserIdPatch**](OrganizationsApi.md#organizationsidmembersuseridpatch) | **PATCH** /organizations/{id}/members/{user_id} | Update a member\&#39;s role within an organization |
| [**organizationsIdPatch**](OrganizationsApi.md#organizationsidpatch) | **PATCH** /organizations/{id} | Update an organization |
| [**organizationsPost**](OrganizationsApi.md#organizationspost) | **POST** /organizations | Create a new organization |
| [**organizationsSearchGet**](OrganizationsApi.md#organizationssearchget) | **GET** /organizations/search | Search organizations |



## organizationsBatchPost

> Array&lt;OrganizationResponse&gt; organizationsBatchPost(request)

Get organizations by multiple IDs (batch)

Get multiple organizations by their UUIDs in a single request

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsBatchPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // GetOrganizationsByIDsRequest | List of organization IDs
    request: ...,
  } satisfies OrganizationsBatchPostRequest;

  try {
    const data = await api.organizationsBatchPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **request** | [GetOrganizationsByIDsRequest](GetOrganizationsByIDsRequest.md) | List of organization IDs | |

### Return type

[**Array&lt;OrganizationResponse&gt;**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **422** | Unprocessable Entity |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsCoordinatesGet

> Array&lt;OrganizationCoord&gt; organizationsCoordinatesGet()

Get all organization coordinates

Get ID and coordinates of all organizations

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsCoordinatesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  try {
    const data = await api.organizationsCoordinatesGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;OrganizationCoord&gt;**](OrganizationCoord.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsGet

> Array&lt;OrganizationResponse&gt; organizationsGet()

Get all organizations

Get a list of all organizations

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  try {
    const data = await api.organizationsGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;OrganizationResponse&gt;**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdDelete

> organizationsIdDelete(id)

Delete an organization

Soft delete an organization by ID

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID (UUID)
    id: id_example,
  } satisfies OrganizationsIdDeleteRequest;

  try {
    const data = await api.organizationsIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID (UUID) | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | No Content |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdGet

> OrganizationResponse organizationsIdGet(id)

Get an organization by ID

Get a single organization by their ID

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID
    id: id_example,
  } satisfies OrganizationsIdGetRequest;

  try {
    const data = await api.organizationsIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID | [Defaults to `undefined`] |

### Return type

[**OrganizationResponse**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **404** | Not Found |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdMembersGet

> Array&lt;UserWithRoleResponse&gt; organizationsIdMembersGet(id)

Get members of an organization

Get all users that belong to an organization

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdMembersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID
    id: id_example,
  } satisfies OrganizationsIdMembersGetRequest;

  try {
    const data = await api.organizationsIdMembersGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID | [Defaults to `undefined`] |

### Return type

[**Array&lt;UserWithRoleResponse&gt;**](UserWithRoleResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdMembersPost

> organizationsIdMembersPost(id, req)

Add a member to an organization

Add an existing user to an organization with an optional manager role

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdMembersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID
    id: id_example,
    // AddMemberRequest | Member to add
    req: ...,
  } satisfies OrganizationsIdMembersPostRequest;

  try {
    const data = await api.organizationsIdMembersPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID | [Defaults to `undefined`] |
| **req** | [AddMemberRequest](AddMemberRequest.md) | Member to add | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **422** | Unprocessable Entity |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdMembersUserIdDelete

> organizationsIdMembersUserIdDelete(id, userId)

Remove a member from an organization

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdMembersUserIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID
    id: id_example,
    // string | User ID
    userId: userId_example,
  } satisfies OrganizationsIdMembersUserIdDeleteRequest;

  try {
    const data = await api.organizationsIdMembersUserIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID | [Defaults to `undefined`] |
| **userId** | `string` | User ID | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | No Content |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdMembersUserIdPatch

> organizationsIdMembersUserIdPatch(id, userId, req)

Update a member\&#39;s role within an organization

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdMembersUserIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID
    id: id_example,
    // string | User ID
    userId: userId_example,
    // SetRoleRequest | Role to set
    req: ...,
  } satisfies OrganizationsIdMembersUserIdPatchRequest;

  try {
    const data = await api.organizationsIdMembersUserIdPatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID | [Defaults to `undefined`] |
| **userId** | `string` | User ID | [Defaults to `undefined`] |
| **req** | [SetRoleRequest](SetRoleRequest.md) | Role to set | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | No Content |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsIdPatch

> OrganizationResponse organizationsIdPatch(id, organization)

Update an organization

Update an existing organization by ID (partial updates supported)

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Organization ID (UUID)
    id: id_example,
    // UpdateOrganizationRequest | Fields to update
    organization: ...,
  } satisfies OrganizationsIdPatchRequest;

  try {
    const data = await api.organizationsIdPatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Organization ID (UUID) | [Defaults to `undefined`] |
| **organization** | [UpdateOrganizationRequest](UpdateOrganizationRequest.md) | Fields to update | |

### Return type

[**OrganizationResponse**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **404** | Not Found |  -  |
| **422** | Unprocessable Entity |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsPost

> OrganizationResponse organizationsPost(organization)

Create a new organization

Create a new organization with name, location, and optional details

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // CreateOrganizationRequest | Organization to create
    organization: ...,
  } satisfies OrganizationsPostRequest;

  try {
    const data = await api.organizationsPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **organization** | [CreateOrganizationRequest](CreateOrganizationRequest.md) | Organization to create | |

### Return type

[**OrganizationResponse**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Created |  -  |
| **400** | Bad Request |  -  |
| **422** | Unprocessable Entity |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## organizationsSearchGet

> Array&lt;OrganizationResponse&gt; organizationsSearchGet(q, limit)

Search organizations

Search organizations by name using ILIKE query

### Example

```ts
import {
  Configuration,
  OrganizationsApi,
} from '';
import type { OrganizationsSearchGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OrganizationsApi();

  const body = {
    // string | Search query
    q: q_example,
    // number | Maximum number of results to return (default: 100) (optional)
    limit: 56,
  } satisfies OrganizationsSearchGetRequest;

  try {
    const data = await api.organizationsSearchGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **q** | `string` | Search query | [Defaults to `undefined`] |
| **limit** | `number` | Maximum number of results to return (default: 100) | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;OrganizationResponse&gt;**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

