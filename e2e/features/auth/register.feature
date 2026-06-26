Feature: Registration
  As a new user
  I want to create an account tied to my organization
  So that I can request experiments

  Background:
    Given the following organizations exist:
      | name      |
      | Acme Labs |

  Scenario: Registering creates the account, assigns the organization, and signs in
    When I register as "New User" with email "new.user@example.com" password "password123" in organization "Acme Labs"
    Then I should be on the "my experiments" page

  Scenario: Registering with an email already in use is rejected
    Given the following users exist:
      | name        | email           | password    | role |
      | Existing Eo | dup@example.com | password123 | user |
    When I register as "Duplicate" with email "dup@example.com" password "password123" in organization "Acme Labs"
    Then I should see the error containing "email"
    And I should be on the login page
