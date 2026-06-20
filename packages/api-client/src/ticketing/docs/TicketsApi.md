# TicketsApi

All URIs are relative to *http://localhost:8080*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1TicketsGet**](TicketsApi.md#apiv1ticketsget) | **GET** /api/v1/tickets | List tickets |
| [**apiV1TicketsIdDelete**](TicketsApi.md#apiv1ticketsiddelete) | **DELETE** /api/v1/tickets/{id} | Delete a ticket |
| [**apiV1TicketsIdGet**](TicketsApi.md#apiv1ticketsidget) | **GET** /api/v1/tickets/{id} | Get a ticket by ID |
| [**apiV1TicketsIdStatusPatch**](TicketsApi.md#apiv1ticketsidstatuspatch) | **PATCH** /api/v1/tickets/{id}/status | Transition ticket status |
| [**apiV1TicketsPost**](TicketsApi.md#apiv1ticketspost) | **POST** /api/v1/tickets | Create a ticket |



## apiV1TicketsGet

> Array&lt;GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse&gt; apiV1TicketsGet(userId, organizationId, status, sortBy, sortDir)

List tickets

### Example

```ts
import {
  Configuration,
  TicketsApi,
} from '';
import type { ApiV1TicketsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TicketsApi();

  const body = {
    // string | Filter by user ID (optional)
    userId: userId_example,
    // string | Filter by organization ID (optional)
    organizationId: organizationId_example,
    // string | Filter by status (optional)
    status: status_example,
    // string | Sort field (created_at, updated_at, status) (optional)
    sortBy: sortBy_example,
    // string | Sort direction (asc, desc) (optional)
    sortDir: sortDir_example,
  } satisfies ApiV1TicketsGetRequest;

  try {
    const data = await api.apiV1TicketsGet(body);
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
| **userId** | `string` | Filter by user ID | [Optional] [Defaults to `undefined`] |
| **organizationId** | `string` | Filter by organization ID | [Optional] [Defaults to `undefined`] |
| **status** | `string` | Filter by status | [Optional] [Defaults to `undefined`] |
| **sortBy** | `string` | Sort field (created_at, updated_at, status) | [Optional] [Defaults to `undefined`] |
| **sortDir** | `string` | Sort direction (asc, desc) | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse&gt;**](GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse.md)

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


## apiV1TicketsIdDelete

> apiV1TicketsIdDelete(id)

Delete a ticket

### Example

```ts
import {
  Configuration,
  TicketsApi,
} from '';
import type { ApiV1TicketsIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TicketsApi();

  const body = {
    // string | Ticket ID
    id: id_example,
  } satisfies ApiV1TicketsIdDeleteRequest;

  try {
    const data = await api.apiV1TicketsIdDelete(body);
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
| **id** | `string` | Ticket ID | [Defaults to `undefined`] |

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
| **404** | Not Found |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1TicketsIdGet

> GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse apiV1TicketsIdGet(id)

Get a ticket by ID

### Example

```ts
import {
  Configuration,
  TicketsApi,
} from '';
import type { ApiV1TicketsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TicketsApi();

  const body = {
    // string | Ticket ID
    id: id_example,
  } satisfies ApiV1TicketsIdGetRequest;

  try {
    const data = await api.apiV1TicketsIdGet(body);
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
| **id** | `string` | Ticket ID | [Defaults to `undefined`] |

### Return type

[**GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse**](GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse.md)

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


## apiV1TicketsIdStatusPatch

> GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse apiV1TicketsIdStatusPatch(id, body)

Transition ticket status

### Example

```ts
import {
  Configuration,
  TicketsApi,
} from '';
import type { ApiV1TicketsIdStatusPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TicketsApi();

  const body = {
    // string | Ticket ID
    id: id_example,
    // GithubComHoshinaDevTicketingServiceInternalDtoTransitionStatusRequest | Transition request
    body: ...,
  } satisfies ApiV1TicketsIdStatusPatchRequest;

  try {
    const data = await api.apiV1TicketsIdStatusPatch(body);
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
| **id** | `string` | Ticket ID | [Defaults to `undefined`] |
| **body** | [GithubComHoshinaDevTicketingServiceInternalDtoTransitionStatusRequest](GithubComHoshinaDevTicketingServiceInternalDtoTransitionStatusRequest.md) | Transition request | |

### Return type

[**GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse**](GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse.md)

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
| **409** | Conflict |  -  |
| **422** | Unprocessable Entity |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1TicketsPost

> GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse apiV1TicketsPost(body)

Create a ticket

### Example

```ts
import {
  Configuration,
  TicketsApi,
} from '';
import type { ApiV1TicketsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TicketsApi();

  const body = {
    // GithubComHoshinaDevTicketingServiceInternalDtoCreateTicketRequest | Create ticket
    body: ...,
  } satisfies ApiV1TicketsPostRequest;

  try {
    const data = await api.apiV1TicketsPost(body);
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
| **body** | [GithubComHoshinaDevTicketingServiceInternalDtoCreateTicketRequest](GithubComHoshinaDevTicketingServiceInternalDtoCreateTicketRequest.md) | Create ticket | |

### Return type

[**GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse**](GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse.md)

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
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

