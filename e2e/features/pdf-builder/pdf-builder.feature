Feature: PDF template builder
  Lab staff design the PDF report layout for an experiment template in a
  canvas-based editor: the editor mounts with its toolbar, components can be
  added to the canvas, the layout is saved through the experiment-manager, and
  it can be previewed with a real experiment's data.

  Background:
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And a PDF template exists for editing
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: The PDF editor mounts for a template
    When I open the PDF editor
    Then I should see the PDF editor toolbar

  Scenario: Adding a text component to the canvas
    When I open the PDF editor
    And I add a text component
    Then I should see the component inspector
    And the layout should have unsaved changes

  Scenario: Saving the layout persists the PDF template
    When I open the PDF editor
    And I add a text component
    And I save the layout
    Then I should see the save confirmation
    And the PDF template should have been saved

  Scenario: Previewing the layout with an experiment populates the canvas
    When I open the PDF editor
    And I preview the experiment "Preview Experiment"
    Then the canvas should show the previewed value "Acme Sample"
