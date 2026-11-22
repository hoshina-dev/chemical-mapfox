Feature: Staff experiment lifecycle transitions
  As lab staff
  I want to move an experiment ticket through its guarded lifecycle
  So that each step (check-in, start, finish, close, cancel) only happens when it's valid

  experiment-manager derives the ticket status from what happened to it and its
  methods: REQUESTED → RECEIVED → IN_PROGRESS (a method started) → COMPLETED
  (every method finished) → CLOSED, and any open ticket can be CANCELLED with a
  reason. It refuses an invalid command with a 409 whose message the app shows.

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: Checking in a shipped sample moves it to "sample received"
    Given an experiment "ctx-checkin" is at the "REQUESTED" stage
    When I visit "/internal/experiment/checkin/ctx-checkin"
    And I check in the sample for "ctx-checkin"
    Then ticket "ctx-checkin" should be in the "RECEIVED" stage
    And I should be on the workspace for "ctx-checkin"

  Scenario: Starting the experiment unlocks the collaborative editor
    Given an experiment "ctx-start" is at the "RECEIVED" stage
    When I visit "/internal/experiment/ctx-start"
    And I start the experiment "ctx-start"
    Then ticket "ctx-start" should be in the "IN_PROGRESS" stage
    And the lab form editor should be unlocked

  Scenario: Finishing the last method completes the ticket
    Given an experiment "ctx-finish" is at the "IN_PROGRESS" stage
    When I visit "/internal/experiment/ctx-finish"
    And I finish the experiment "ctx-finish"
    Then ticket "ctx-finish" should be in the "COMPLETED" stage
    And I should see the message "Experiment finished"

  Scenario: Publishing the report, which closes the ticket, is offered only once every method is finished
    Given an experiment "ctx-close" is at the "IN_PROGRESS" stage
    When I visit "/internal/experiment/ctx-close"
    Then I should not be able to publish the report
    When I finish the experiment "ctx-close"
    And I publish the report for "ctx-close"
    Then ticket "ctx-close" should be in the "CLOSED" stage

  Scenario: Cancelling an open ticket records the reason
    Given an experiment "ctx-cancel" is at the "RECEIVED" stage
    When I visit "/internal/experiment/ctx-cancel"
    And I cancel the ticket "ctx-cancel" because "Sample leaked in transit"
    Then ticket "ctx-cancel" should be in the "CANCELLED" stage
    And I should see the message "Sample leaked in transit"

  Scenario: A refused transition surfaces experiment-manager's message
    Given an experiment "ctx-invalid" is at the "RECEIVED" stage
    And experiment-manager finds ticket "ctx-invalid" busy on the next command
    When I visit "/internal/experiment/ctx-invalid"
    And I try to start the experiment "ctx-invalid"
    Then I should see the error containing "the ticket is busy; try again"
    And ticket "ctx-invalid" should be in the "RECEIVED" stage

  Scenario: A method started by someone else meanwhile shows as in progress
    Given an experiment "ctx-race" is at the "RECEIVED" stage
    When I visit "/internal/experiment/ctx-race"
    And another technician starts experiment "ctx-race" meanwhile
    And I click Start experiment
    Then the workspace shows the method as already started
    And ticket "ctx-race" should be in the "IN_PROGRESS" stage
