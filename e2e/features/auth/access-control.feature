Feature: Access control
  The middleware guards routes by authentication and role:
  unauthenticated users are sent to login, clients are kept out of the
  staff (/internal, /admin) area, and lab staff are kept out of the client
  request flow.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Casey Client | client@example.com | password123 | user  |
      | Avery Admin  | admin@example.com  | password123 | admin |

  Scenario: An unauthenticated visitor to the staff area is sent to login
    Given I am not signed in
    When I visit "/internal/experiment/onboarding"
    Then I should be on the login page

  Scenario: An unauthenticated visitor to the client area is sent to login
    Given I am not signed in
    When I visit "/experiment/listing"
    Then I should be on the login page

  Scenario: A client cannot reach the staff area
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/internal/experiment/onboarding"
    Then I should be on the "my experiments" page

  Scenario: A lab-staff admin cannot reach the client request flow
    Given I am signed in as "admin@example.com" with password "password123"
    When I visit "/experiment/request/listing"
    Then I should be on the "staff experiments" page

  Scenario: A signed-in user visiting the login page is redirected to their workspace
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/login"
    Then I should be on the "my experiments" page
