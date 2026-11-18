Feature: Report form editor
  Lab staff set up one report per sample type: they upload the lab's blank
  report (PDF) to experiment-manager, then place the values it prints by picking a
  value and clicking where it goes. Placements autosave.

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And the sample "Coal" has an experiment template "Moisture Analysis"
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: A sample type without a report form asks for the blank PDF
    Given the sample "Coal" has no report form
    When I open the report form of "Coal"
    Then I should see "No report form yet"
    And the sample page of "Coal" warns that it has no report template

  Scenario: Uploading the blank PDF stores it and opens the editor
    Given the sample "Coal" has no report form
    When I open the report form of "Coal"
    And I upload a blank report form PDF
    Then the report form editor should show the PDF
    And experiment-manager stored a report form PDF for "Coal"

  Scenario: Placing a value autosaves it to experiment-manager
    When I open the report form of "Coal"
    Then the report form editor should show the PDF
    When I place "Sample type" on the page
    Then the report form should say "Saved"
    And experiment-manager's report form for "Coal" places "sampleType.name"

  Scenario: A placed value can be removed
    Given the report form of "Coal" places "sampleType.name"
    When I open the report form of "Coal"
    Then the report form editor should show the PDF
    When I remove the placed "Sample type"
    Then the report form should say "Saved"
    And experiment-manager's report form for "Coal" places nothing
