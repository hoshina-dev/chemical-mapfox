Feature: Staff raw experiment view
  As lab staff (an admin)
  I want a raw JSON view of an experiment
  So that I can inspect the experiment-manager ticket (with its experiments) and
  its event history

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Avery Admin  | admin@example.com  | password123 | admin |
      | Casey Client | client@example.com | password123 | user  |
    And the following experiment tickets exist:
      | id      | name             | status      | requester          |
      | ctx-raw | Spectroscopy Run | in progress | client@example.com |
    And the lab recorded analyst "Marie Curie" on "ctx-raw"
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: The raw view shows the ticket JSON and its event history
    When I open the raw view for "ctx-raw"
    Then the raw ticket JSON should contain "Spectroscopy Run"
    And the raw ticket JSON should contain "ctx-raw"
    And the raw ticket JSON should contain "Marie Curie"
    And the raw event history should contain "ticket.requested"
