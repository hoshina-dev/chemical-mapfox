Feature: Registration
  As a new user
  I want to create an account
  So that I can request experiments

  Scenario: Registering creates the account, assigns CHEMFOX_ORG, and signs in
    When I register as "New User" with email "new.user@example.com" password "password123"
    Then I should be on the "my experiments" page
    And the user "new.user@example.com" should belong to organization "CHEMFOX_ORG"

  Scenario: Registering with an email already in use is rejected
    Given the following users exist:
      | name        | email           | password    | role |
      | Existing Eo | dup@example.com | password123 | user |
    When I register as "Duplicate" with email "dup@example.com" password "password123"
    Then I should see the error containing "email"
    And I should be on the login page
