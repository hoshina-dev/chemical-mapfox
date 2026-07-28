Feature: Staff user lookup
  Mapfox admins have a staff-only console at /admin/users for readonly
  user search and detail lookup. Clients have no business there and are
  bounced back to their own workspace.

  Background:
    Given the following users exist:
      | name          | email              | password    | role  |
      | Avery Admin   | avery@example.com  | password123 | admin |
      | Morgan Mapfox | morgan@example.com | password123 | admin |
      | Casey Client  | casey@example.com  | password123 | user  |
      | Dana Doe      | dana@example.com   | password123 | user  |

  Scenario: An admin can search users and view readonly detail
    Given I am signed in as "avery@example.com" with password "password123"
    When I visit "/admin/users"
    And I search users for "Casey"
    Then the users search results should list:
      | name         | email             | role |
      | Casey Client | casey@example.com | user |
    When I select the user "casey@example.com" from search results
    Then the user detail should show:
      | field | value             |
      | Name  | Casey Client      |
      | Email | casey@example.com |
      | Role  | user              |

  Scenario: An admin search with no matches shows an empty state
    Given I am signed in as "avery@example.com" with password "password123"
    When I visit "/admin/users"
    And I search users for "zzzz-no-such-user"
    Then the users search results should be empty

  Scenario: A client is redirected away from the admin area to their workspace
    Given I am signed in as "casey@example.com" with password "password123"
    When I visit "/admin/users"
    Then I should be on the "my experiments" page
