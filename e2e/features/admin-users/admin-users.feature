Feature: User & organization administration
  Mapfox admins have a staff-only console at /admin/users that lists every
  user (with their role) and every organization, plus headline counts of each.
  Clients have no business there and are bounced back to their own workspace.

  # "Acme Labs" is the baseline organization seeded for every scenario
  # (see support/fixtures.ts resetDb), so the organization count/list below
  # includes it alongside the two seeded here.
  Background:
    Given the following organizations exist:
      | name        |
      | Globex Corp |
      | Initech     |
    And the following users exist:
      | name          | email              | password    | role  | organization |
      | Avery Admin   | avery@example.com  | password123 | admin | Globex Corp  |
      | Morgan Mapfox | morgan@example.com | password123 | admin | Initech      |
      | Casey Client  | casey@example.com  | password123 | user  | Globex Corp  |
      | Dana Doe      | dana@example.com   | password123 | user  | Initech      |

  Scenario: An admin sees the headline counts and the user table with role badges
    Given I am signed in as "avery@example.com" with password "password123"
    When I visit "/admin/users"
    Then the "Users" count should show "4"
    And the "Organizations" count should show "3"
    And the users table should list:
      | name          | email              | role  |
      | Avery Admin   | avery@example.com  | admin |
      | Morgan Mapfox | morgan@example.com | admin |
      | Casey Client  | casey@example.com  | user  |
      | Dana Doe      | dana@example.com   | user  |

  Scenario: An admin sees every organization listed
    Given I am signed in as "avery@example.com" with password "password123"
    When I visit "/admin/users"
    Then the organizations list should include:
      | name        |
      | Acme Labs   |
      | Globex Corp |
      | Initech     |

  Scenario: A client is redirected away from the admin area to their workspace
    Given I am signed in as "casey@example.com" with password "password123"
    When I visit "/admin/users"
    Then I should be on the "my experiments" page
