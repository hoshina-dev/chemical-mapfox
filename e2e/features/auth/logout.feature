Feature: Logout
  As a signed-in user
  I want to log out
  So that my session ends and I return to the login page

  Background:
    Given the following users exist:
      | name         | email              | password    | role |
      | Casey Client | client@example.com | password123 | user |

  Scenario: A signed-in client logs out
    Given I am signed in as "client@example.com" with password "password123"
    When I log out
    Then I should be on the login page
