# UsersApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**usersEmailEmailGet**](UsersApi.md#usersemailemailget) | **GET** /users/email/{email} | Get a user by email |
| [**usersGet**](UsersApi.md#usersget) | **GET** /users | Get all users |
| [**usersIdIdDelete**](UsersApi.md#usersididdelete) | **DELETE** /users/id/{id} | Delete a user |
| [**usersIdIdGet**](UsersApi.md#usersididget) | **GET** /users/id/{id} | Get a user by ID |
| [**usersIdIdOrganizationsGet**](UsersApi.md#usersididorganizationsget) | **GET** /users/id/{id}/organizations | Get a user\&#39;s organizations |
| [**usersIdIdPatch**](UsersApi.md#usersididpatch) | **PATCH** /users/id/{id} | Update a user |
| [**usersPost**](UsersApi.md#userspost) | **POST** /users | Create a new user |
| [**usersSearchGet**](UsersApi.md#userssearchget) | **GET** /users/search | Search users |



## usersEmailEmailGet

> UserDetailResponse usersEmailEmailGet(email)

Get a user by email

Get a single user by their email address

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersEmailEmailGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string | User email address
    email: email_example,
  } satisfies UsersEmailEmailGetRequest;

  try {
    const data = await api.usersEmailEmailGet(body);
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
| **email** | `string` | User email address | [Defaults to `undefined`] |

### Return type

[**UserDetailResponse**](UserDetailResponse.md)

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


## usersGet

> Array&lt;UserResponse&gt; usersGet()

Get all users

Returns a list of all users

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  try {
    const data = await api.usersGet();
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

[**Array&lt;UserResponse&gt;**](UserResponse.md)

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


## usersIdIdDelete

> usersIdIdDelete(id)

Delete a user

Soft delete a user by ID

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersIdIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string | User ID (UUID)
    id: id_example,
  } satisfies UsersIdIdDeleteRequest;

  try {
    const data = await api.usersIdIdDelete(body);
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
| **id** | `string` | User ID (UUID) | [Defaults to `undefined`] |

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


## usersIdIdGet

> UserDetailResponse usersIdIdGet(id)

Get a user by ID

Get a single user by their UUID

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersIdIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string | User ID (UUID)
    id: id_example,
  } satisfies UsersIdIdGetRequest;

  try {
    const data = await api.usersIdIdGet(body);
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
| **id** | `string` | User ID (UUID) | [Defaults to `undefined`] |

### Return type

[**UserDetailResponse**](UserDetailResponse.md)

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


## usersIdIdOrganizationsGet

> Array&lt;UserMembershipResponse&gt; usersIdIdOrganizationsGet(id)

Get a user\&#39;s organizations

Get all organizations a user belongs to with their role

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersIdIdOrganizationsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string | User ID (UUID)
    id: id_example,
  } satisfies UsersIdIdOrganizationsGetRequest;

  try {
    const data = await api.usersIdIdOrganizationsGet(body);
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
| **id** | `string` | User ID (UUID) | [Defaults to `undefined`] |

### Return type

[**Array&lt;UserMembershipResponse&gt;**](UserMembershipResponse.md)

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


## usersIdIdPatch

> UserResponse usersIdIdPatch(id, user)

Update a user

Update an existing user by ID (partial updates supported)

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersIdIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string | User ID (UUID)
    id: id_example,
    // UpdateUserRequest | Fields to update
    user: ...,
  } satisfies UsersIdIdPatchRequest;

  try {
    const data = await api.usersIdIdPatch(body);
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
| **id** | `string` | User ID (UUID) | [Defaults to `undefined`] |
| **user** | [UpdateUserRequest](UpdateUserRequest.md) | Fields to update | |

### Return type

[**UserResponse**](UserResponse.md)

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


## usersPost

> UserResponse usersPost(user)

Create a new user

Create a new user with email, name, organization, and optional details

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // CreateUserRequest | User to create
    user: ...,
  } satisfies UsersPostRequest;

  try {
    const data = await api.usersPost(body);
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
| **user** | [CreateUserRequest](CreateUserRequest.md) | User to create | |

### Return type

[**UserResponse**](UserResponse.md)

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


## usersSearchGet

> Array&lt;UserResponse&gt; usersSearchGet(q, limit)

Search users

Search users by name or email using ILIKE query

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersSearchGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string | Search query
    q: q_example,
    // number | Maximum number of results to return (default: 100) (optional)
    limit: 56,
  } satisfies UsersSearchGetRequest;

  try {
    const data = await api.usersSearchGet(body);
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

[**Array&lt;UserResponse&gt;**](UserResponse.md)

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

