Feature: Finalization — calculations and the PDF report
  Finishing a method calculates its results in the browser and stores them in
  experiment-manager. Once every method is finished the ticket is COMPLETED: staff
  publish the report (filled from the sample type's report form), after which
  staff and the requester can download it, and close the ticket.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Avery Admin  | admin@example.com  | password123 | admin |
      | Casey Client | client@example.com | password123 | user  |
    And an in-progress purity experiment "exp-001" requested by "client@example.com"
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: Finishing the experiment calculates and stores the results
    When I open the workspace for "exp-001"
    And I finish the experiment "exp-001"
    Then the calculations should show a result of "90"
    And experiment-manager stored the result "90" for "purity" on "exp-001"

  Scenario: A published report can be downloaded by staff and the requester
    When I open the workspace for "exp-001"
    And I finish the experiment "exp-001"
    And I publish the report for "exp-001"
    Then the report panel should be shown
    And the staff report download for "exp-001" should be a PDF
    Given I am not signed in
    And I am signed in as "client@example.com" with password "password123"
    Then the requester report download for "exp-001" should be a PDF

  Scenario: A report cannot be published without a report form
    Given the sample "Coal" has no report form
    When I open the workspace for "exp-001"
    And I finish the experiment "exp-001"
    And I try to publish the report
    Then I should see the error containing "sample type has no report form"

  Scenario: The ticket is closed after the report is published
    When I open the workspace for "exp-001"
    And I finish the experiment "exp-001"
    And I publish the report for "exp-001"
    And I close the ticket "exp-001"
    Then ticket "exp-001" should be in the "CLOSED" stage
    And the report panel should be shown
