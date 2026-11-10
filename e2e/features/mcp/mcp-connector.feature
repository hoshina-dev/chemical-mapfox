Feature: MCP connector for lab staff
  Lab staff connect an AI assistant to the lab workspace through the built-in
  OAuth 2.1 server. Discovery needs no session; only admins can approve
  consent. After tokens are issued, MCP tools act on the same experiment
  tickets as the staff workspace.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Casey Client | client@example.com | password123 | user  |
      | Avery Admin  | admin@example.com  | password123 | admin |

  Scenario: Unauthenticated MCP discovery advertises PKCE S256 and registration
    When I POST "/api/mcp" without a bearer token
    Then the HTTP response status is 401
    And the WWW-Authenticate header points at the protected-resource metadata
    When I GET the protected-resource metadata from that challenge
    Then the metadata document is JSON reachable without a session
    And it advertises this origin as the authorization server
    When I GET "/.well-known/oauth-authorization-server" without a session
    Then the authorization server metadata advertises S256 and the registration endpoint

  Scenario: A lab-staff admin completes the connect flow and uses MCP tools
    Given an experiment "ctx-mcp-coal" is at the "REQUESTED" stage
    And the following experiment tickets exist:
      | id           | name                    | status    |
      | ctx-mcp-coal | Coal Proximate Analysis | REQUESTED |
    And I register an MCP client named "Claude" with redirect URI "https://claude.ai/api/mcp/auth_callback"
    And I am not signed in
    When I open the OAuth authorize page for "Claude"
    Then I should be on the login page
    When I sign in on this page with email "admin@example.com" and password "password123"
    Then I should be on the OAuth consent page
    When I allow OAuth access
    And I exchange the authorization code for tokens
    Then the token response includes an access token and a refresh token
    When I send MCP "initialize"
    And I send MCP "tools/list"
    Then the tool list includes the lab workspace tools
    When I call MCP tool "list_experiments"
    Then the MCP tool result includes experiment "ctx-mcp-coal"
    When I call MCP tool "check_in_sample" with context id "ctx-mcp-coal"
    Then ticket "ctx-mcp-coal" should be in the "PENDING" stage

  Scenario: Unticking a permission on consent hides those tools
    Given I register an MCP client named "Claude" with redirect URI "https://claude.ai/api/mcp/auth_callback"
    And I am signed in as "admin@example.com" with password "password123"
    When I open the OAuth authorize page for "Claude"
    And I untick "Run experiments" on the OAuth consent page
    And I allow OAuth access
    And I exchange the authorization code for tokens
    Then the token response grants scope "experiments:read templates:write"
    When I send MCP "initialize"
    And I send MCP "tools/list"
    Then the tool list does not include "check_in_sample"
    And the tool list includes "onboard_template"
    And the tool list includes "read_doc"

  Scenario: A client cannot approve the MCP connector
    Given I register an MCP client named "Claude" with redirect URI "https://claude.ai/api/mcp/auth_callback"
    And I am signed in as "client@example.com" with password "password123"
    When I open the OAuth authorize page for "Claude"
    Then I should see the "Lab staff only" heading
    And I should see "Only lab staff of Harper Analytics can connect AI assistants."
    And I should not be able to allow OAuth access

  Scenario: Cancelling consent redirects with access_denied
    Given I register an MCP client named "Claude" with redirect URI "https://claude.ai/api/mcp/auth_callback"
    And I am signed in as "admin@example.com" with password "password123"
    When I open the OAuth authorize page for "Claude"
    And I cancel OAuth access
    Then the OAuth callback has error "access_denied" and the original state

  Scenario: Refresh tokens rotate and the previous one is rejected
    Given I register an MCP client named "Claude" with redirect URI "https://claude.ai/api/mcp/auth_callback"
    And I am signed in as "admin@example.com" with password "password123"
    And I complete the MCP OAuth consent
    When I exchange the refresh token
    Then the new access token can call the MCP server
    When I reuse the previous refresh token
    Then the token endpoint rejects it with "invalid_grant"

  Scenario: An unknown redirect host is warned about, but Claude is not
    Given I register an MCP client named "Sketchy App" with redirect URI "https://sketchy.example/callback"
    And I register an MCP client named "Claude" with redirect URI "https://claude.ai/api/mcp/auth_callback"
    And I am signed in as "admin@example.com" with password "password123"
    When I open the OAuth authorize page for "Sketchy App"
    Then I should see "This app isn't Claude or ChatGPT"
    When I open the OAuth authorize page for "Claude"
    Then I should be on the OAuth consent page
    And the unknown-app warning should not be shown
