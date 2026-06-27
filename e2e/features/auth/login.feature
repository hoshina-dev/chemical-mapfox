Feature: Login
  As a registered user
  I want to sign in with my email and password
  So that I can reach my workspace

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Casey Client | client@example.com | password123 | user  |
      | Avery Admin  | admin@example.com  | password123 | admin |

  Scenario: A client signs in successfully and lands on their experiments board
    When I sign in with email "client@example.com" and password "password123"
    Then I should be on the "my experiments" page

  Scenario: A lab-staff admin signs in and lands on the staff experiments listing
    When I sign in with email "admin@example.com" and password "password123"
    Then I should be on the "staff experiments" page

  Scenario: Signing in with the wrong password is rejected
    When I sign in with email "client@example.com" and password "wrong-password"
    Then I should see the error "Invalid email or password."
    And I should be on the login page

  Scenario: Signing in with an unknown email is rejected
    When I sign in with email "nobody@example.com" and password "password123"
    Then I should see the error "Invalid email or password."
    And I should be on the login page
