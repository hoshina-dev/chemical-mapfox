Feature: Landing page
  The public homepage at "/" introduces ChemFox laboratory services to
  visitors. It is reachable without signing in; call-to-action controls send
  unauthenticated visitors to sign-in.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Casey Client | client@example.com | password123 | user  |

  Scenario: An unauthenticated visitor sees the marketing homepage
    Given I am not signed in
    When I visit "/"
    Then I should be on the landing page
    And I should see the landing hero
    And I should see the primary navigation link "Laboratory offer"
    And I should see the primary navigation link "Certifications"
    And I should see the "Get started" call to action

  Scenario: Get started sends an unauthenticated visitor to sign-in
    Given I am not signed in
    When I visit "/"
    And I click the "Get started" call to action
    Then I should be on the login page

  Scenario: Sign in in the header sends an unauthenticated visitor to sign-in
    Given I am not signed in
    When I visit "/"
    And I click the "Sign in" link
    Then I should be on the login page

  Scenario: The laboratory offer lists seeded specimens and methods
    Given the catalog offers a sample "Coal" with experiment "Proximate analysis"
    When I visit "/"
    Then I should see the specimen "Coal" in the laboratory offer
    When I expand the "Coal" specimen in the laboratory offer
    Then I should see the experiment "Proximate analysis" in the laboratory offer

  Scenario: A signed-in client sees a workspace call-to-action on the homepage
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/"
    Then I should be on the landing page
    And I should see the "Go to your workspace" call to action
    And I should not see the "Sign in" link
