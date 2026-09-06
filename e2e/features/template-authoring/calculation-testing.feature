Feature: Testing calculation formulas during onboarding
  As lab staff (a mapfox admin) authoring an experiment template
  I want to run my calculation formulas against trial values before I save the template
  So that a typo or a broken expression is caught during onboarding, not after a technician has entered real measurements

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And I am signed in as "admin@example.com" with password "password123"
    And I visit "/internal/experiment/onboarding"
    And I open the sample "Coal"
    And I start a new template
    And I name the template "Moisture Content"

  Scenario: Formulas that reference each other are evaluated in dependency order
    When I add a calculation "base" with formula "2 + 3"
    And I add a calculation "scaled" with formula "base * 10"
    And I open the live preview
    And I run the draft calculations
    Then the calculation "base" should show the result "5"
    And the calculation "scaled" should show the result "50"
    And the calculation report should say "All 2 formulas evaluated successfully"

  Scenario: A typo in a question id is reported without hiding the working formulas
    When I add a calculation "good" with formula "4 * 5"
    And I add a calculation "typo" with formula "values['sample_mas'] * 2"
    And I open the live preview
    And I run the draft calculations
    Then the calculation "good" should show the result "20"
    And the calculation "typo" should be marked "Error"
    And the calculation report should say "1 formula needs attention"
    And I should see the missing-values warning for "sample_mas"

  Scenario: A formula depending on a failed formula is skipped rather than cascading
    When I add a calculation "broken" with formula "values['nope'] + 1"
    And I add a calculation "downstream" with formula "broken * 2"
    And I open the live preview
    And I run the draft calculations
    Then the calculation "broken" should be marked "Error"
    And the calculation "downstream" should be marked "Skipped"

  Scenario: A circular reference is reported against every formula in the cycle
    When I add a calculation "a" with formula "b + 1"
    And I add a calculation "b" with formula "a + 1"
    And I open the live preview
    And I run the draft calculations
    Then the calculation "a" should be marked "Error"
    And the calculation "b" should be marked "Error"

  Scenario: A template with no calculations has nothing to test
    When I open the live preview
    Then I should see that there are no calculations to test
