Feature: Client — track experiments
  As a client
  I want to see every experiment I've requested and follow its progress
  So that I know where each one is in the lab's workflow

  Background:
    Given the following users exist:
      | name         | email              | password    | role |
      | Casey Client | client@example.com | password123 | user |
      | Dana Other   | other@example.com  | password123 | user |

  Scenario: Experiments are grouped into the correct lifecycle lanes
    Given the following experiments exist for "client@example.com":
      | name             | status        |
      | Soil pH Analysis | REQUESTED     |
      | Water Tox Panel  | PENDING       |
      | Polymer Strength | EXPERIMENTING |
      | Resin Cure Study | FINALIZING    |
      | Legacy Assay     | CLOSED        |
    And I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/listing"
    Then the "Requested" lane should contain "Soil pH Analysis"
    And the "Sample received" lane should contain "Water Tox Panel"
    And the "In progress" lane should contain "Polymer Strength"
    And the "Finalizing" lane should contain "Resin Cure Study"
    And the "Closed" lane should contain "Legacy Assay"

  Scenario: A client with no experiments sees the empty state
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/listing"
    Then I should see "You haven't requested any experiments yet."

  Scenario: Opening a requested experiment shows the printable QR sample label
    Given the following experiments exist for "client@example.com":
      | name             | status    | contextId      |
      | Soil pH Analysis | REQUESTED | exp-requested1 |
    And I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/listing/exp-requested1"
    Then I should see "Ship your sample"
    And I should see "/internal/experiment/checkin/exp-requested1"

  Scenario: A client cannot open another client's experiment
    Given the following experiments exist for "other@example.com":
      | name              | status        | contextId    |
      | Confidential Work | EXPERIMENTING | exp-other999 |
    And I am signed in as "client@example.com" with password "password123"
    When I visit "/experiment/listing/exp-other999"
    Then I should see "This page could not be found."
