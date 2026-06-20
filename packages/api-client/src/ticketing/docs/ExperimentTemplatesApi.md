# ExperimentTemplatesApi

All URIs are relative to *http://localhost:8080*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiV1TicketsIdExperimentTemplatesGet**](ExperimentTemplatesApi.md#apiv1ticketsidexperimenttemplatesget) | **GET** /api/v1/tickets/{id}/experiment-templates | List experiment templates on a ticket |
| [**apiV1TicketsIdExperimentTemplatesPost**](ExperimentTemplatesApi.md#apiv1ticketsidexperimenttemplatespost) | **POST** /api/v1/tickets/{id}/experiment-templates | Add an experiment template to a ticket |
| [**apiV1TicketsIdExperimentTemplatesTemplateIdDelete**](ExperimentTemplatesApi.md#apiv1ticketsidexperimenttemplatestemplateiddelete) | **DELETE** /api/v1/tickets/{id}/experiment-templates/{templateId} | Remove an experiment template from a ticket |



## apiV1TicketsIdExperimentTemplatesGet

> Array&lt;GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse&gt; apiV1TicketsIdExperimentTemplatesGet(id)

List experiment templates on a ticket

### Example

```ts
import {
  Configuration,
  ExperimentTemplatesApi,
} from '';
import type { ApiV1TicketsIdExperimentTemplatesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExperimentTemplatesApi();

  const body = {
    // string | Ticket ID
    id: id_example,
  } satisfies ApiV1TicketsIdExperimentTemplatesGetRequest;

  try {
    const data = await api.apiV1TicketsIdExperimentTemplatesGet(body);
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

[**Array&lt;GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse&gt;**](GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse.md)

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


## apiV1TicketsIdExperimentTemplatesPost

> GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse apiV1TicketsIdExperimentTemplatesPost(id, body)

Add an experiment template to a ticket

### Example

```ts
import {
  Configuration,
  ExperimentTemplatesApi,
} from '';
import type { ApiV1TicketsIdExperimentTemplatesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExperimentTemplatesApi();

  const body = {
    // string | Ticket ID
    id: id_example,
    // GithubComHoshinaDevTicketingServiceInternalDtoAddExperimentTemplateRequest | Experiment template
    body: ...,
  } satisfies ApiV1TicketsIdExperimentTemplatesPostRequest;

  try {
    const data = await api.apiV1TicketsIdExperimentTemplatesPost(body);
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
| **body** | [GithubComHoshinaDevTicketingServiceInternalDtoAddExperimentTemplateRequest](GithubComHoshinaDevTicketingServiceInternalDtoAddExperimentTemplateRequest.md) | Experiment template | |

### Return type

[**GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse**](GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse.md)

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
| **409** | Conflict |  -  |
| **500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiV1TicketsIdExperimentTemplatesTemplateIdDelete

> apiV1TicketsIdExperimentTemplatesTemplateIdDelete(id, templateId)

Remove an experiment template from a ticket

### Example

```ts
import {
  Configuration,
  ExperimentTemplatesApi,
} from '';
import type { ApiV1TicketsIdExperimentTemplatesTemplateIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ExperimentTemplatesApi();

  const body = {
    // string | Ticket ID
    id: id_example,
    // string | Experiment template ID
    templateId: templateId_example,
  } satisfies ApiV1TicketsIdExperimentTemplatesTemplateIdDeleteRequest;

  try {
    const data = await api.apiV1TicketsIdExperimentTemplatesTemplateIdDelete(body);
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
| **templateId** | `string` | Experiment template ID | [Defaults to `undefined`] |

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

