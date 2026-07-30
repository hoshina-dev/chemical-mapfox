Feature: Requester help documentation
  Clients can open Help/Docs from their navigation to learn how to request
  experiments, track progress, and ship samples. The area is client-only.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Casey Client | client@example.com | password123 | user  |
      | Avery Admin  | admin@example.com  | password123 | admin |

  Scenario: A client sees the help overview
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/docs"
    Then I should see the "How to use Harper Anslitics" heading

  Scenario: A client can open a how-to guide
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/docs/shipping"
    Then I should see the "Ship your sample" heading

  Scenario: An admin cannot reach client help docs
    Given I am signed in as "admin@example.com" with password "password123"
    When I visit "/experiment/docs"
    Then I should be on the "staff experiments" page
