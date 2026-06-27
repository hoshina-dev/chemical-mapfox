Feature: Request an experiment
  As a signed-in client
  I want to browse the catalogue and request an experiment from a template
  So that the lab receives my request with my intake answers

  Background:
    Given the following users exist:
      | name         | email              | password    | role | organization |
      | Casey Client | client@example.com | password123 | user | Acme Labs    |
    And the catalog offers a sample "Coal" with experiment "Proximate analysis"

  Scenario: A client browses the catalogue and finds the seeded experiment
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/request/listing"
    Then I should be on the "request catalog" page
    And I should see the specimen "Coal"
    When I expand the "Coal" specimen
    Then I should see the experiment "Proximate analysis" in the catalogue

  Scenario: A client requests an experiment by filling in the intake form
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/request/listing"
    And I expand the "Coal" specimen
    And I request the experiment "Proximate analysis"
    Then I should be on the request form for "Proximate analysis"
    When I fill in the "Sample description" field with "Dark anthracite briquettes, 2 kg"
    And I submit the request
    Then I should land on my experiment workspace

  Scenario: A client with no organization is blocked from requesting
    Given a client "lonely@example.com" with password "password123" who belongs to no organization
    And I am signed in as "lonely@example.com" with password "password123"
    When I visit "/experiment/request/listing"
    And I expand the "Coal" specimen
    And I request the experiment "Proximate analysis"
    And I fill in the "Sample description" field with "Loose powder sample"
    And I submit the request
    Then I should see the error containing "member of any organization"
