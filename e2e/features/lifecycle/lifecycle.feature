Feature: Staff experiment lifecycle transitions
  As lab staff
  I want to move an experiment ticket through its guarded lifecycle
  So that each stage (check-in, start, submit, close) only happens when it's valid

  The ticket state machine is REQUESTED → PENDING ("sample received") →
  EXPERIMENTING → FINALIZING → CLOSED. Every transition is guarded; the
  ticketing backend rejects an invalid one with a 422 the app surfaces as a
  friendly error.

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: Checking in a shipped sample moves it to "sample received"
    Given an experiment "ctx-checkin" is at the "REQUESTED" stage
    When I visit "/internal/experiment/checkin/ctx-checkin"
    And I check in the sample for "ctx-checkin"
    Then ticket "ctx-checkin" should be in the "PENDING" stage
    And I should be on the workspace for "ctx-checkin"

  Scenario: Starting the experiment unlocks the collaborative editor
    Given an experiment "ctx-start" is at the "PENDING" stage
    When I visit "/internal/experiment/ctx-start"
    And I start the experiment "ctx-start"
    Then ticket "ctx-start" should be in the "EXPERIMENTING" stage
    And the lab form editor should be unlocked

  Scenario: Submitting the experiment moves it to the finalizing stage
    Given an experiment "ctx-submit" is at the "EXPERIMENTING" stage
    When I visit "/internal/experiment/ctx-submit"
    And I submit experiment "ctx-submit" to the final stage
    Then ticket "ctx-submit" should be in the "FINALIZING" stage
    And I should see the message "Finalize"

  Scenario: Closing is blocked until calculations and the report are done
    Given an experiment "ctx-close" is at the "FINALIZING" stage
    And experiment "ctx-close" has calculations that have not been run
    When I visit "/internal/experiment/ctx-close"
    Then I should not be able to close the ticket
    And I should see the message "Run calculations and generate the report before closing this ticket."
    When I run the lifecycle calculations
    And I generate the lifecycle report
    And I close the ticket "ctx-close"
    Then ticket "ctx-close" should be in the "CLOSED" stage

  Scenario: An invalid transition surfaces the friendly 422 error
    Given an experiment "ctx-invalid" is at the "PENDING" stage
    And the ticketing backend will reject the next transition for "ctx-invalid"
    When I visit "/internal/experiment/ctx-invalid"
    And I try to start the experiment "ctx-invalid"
    Then I should see the error containing "Invalid transition"
    And ticket "ctx-invalid" should be in the "PENDING" stage
