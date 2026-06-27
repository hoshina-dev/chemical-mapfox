Feature: Finalization — calculations and PDF report
  While a ticket is FINALIZING, lab staff run the experiment's calculations and
  generate a PDF report. Report generation is asynchronous, so the workspace
  polls its status until it succeeds, after which the report can be downloaded.
  The ticket can only be closed once both calculations and the report are done.

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And a finalizing experiment "exp-001" exists
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: Running calculations populates the calculation results
    When I open the finalization workspace for "exp-001"
    And I run the calculations
    Then the calculations should show a result of "90"

  Scenario: Generating a report polls through to success
    When I open the finalization workspace for "exp-001"
    And I run the calculations
    And I generate the report
    Then the report should reach the ready state

  Scenario: A ready report enables downloading
    When I open the finalization workspace for "exp-001"
    And I run the calculations
    And I generate the report
    Then the report should reach the ready state
    And I should be able to download the report

  Scenario: Closing the ticket is blocked until calculations and report are done
    When I open the finalization workspace for "exp-001"
    Then I cannot close the ticket yet
    When I run the calculations
    And I generate the report
    And the report should reach the ready state
    And I close the ticket
    Then the ticket should be closed
