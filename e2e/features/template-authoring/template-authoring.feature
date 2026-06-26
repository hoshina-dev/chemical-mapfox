Feature: Sample & experiment-template authoring
  As lab staff (a mapfox admin) onboarding a new specimen type
  I want to register samples and author experiment templates for them
  So that clients can later request experiments against those templates

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: An admin registers a new sample from the onboarding page
    When I visit "/internal/experiment/onboarding"
    And I register a sample named "Soil"
    Then the sample "Soil" should appear in the samples list

  Scenario: Opening a sample lists its experiment templates
    Given the sample "Coal" has an experiment template "Moisture Analysis"
    When I visit "/internal/experiment/onboarding"
    And I open the sample "Coal"
    Then I should see the experiment template "Moisture Analysis"

  Scenario: An admin creates a minimal experiment template with the builder
    When I visit "/internal/experiment/onboarding"
    And I open the sample "Coal"
    And I start a new template
    And I name the template "Ash Content"
    And I add a short-text question with id "ash_pct" labelled "Ash percentage"
    And I save the template
    Then the template "Ash Content" should be saved

  Scenario: An admin edits and deletes an experiment template
    Given the sample "Coal" has an experiment template "Volatile Matter"
    When I visit "/internal/experiment/onboarding"
    And I open the sample "Coal"
    And I open the experiment template "Volatile Matter"
    And I rename the template to "Volatile Matter (rev 2)"
    And I save the template
    Then the template "Volatile Matter (rev 2)" should be saved
    When I delete the template
    Then I should be on the experiment onboarding page
    And the sample "Coal" should have no experiment template "Volatile Matter (rev 2)"
